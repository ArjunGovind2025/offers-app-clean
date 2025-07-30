/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse");

// Ensure Firebase Admin is initialized once
try {
  admin.initializeApp();
} catch (error) {
  // Ignore the "already exists" message
}

// Helper function to parse multipart data manually
function parseMultipartData(body, boundary) {
  // Ensure body is a Buffer
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const parts = buffer.toString('binary').split(`--${boundary}`);
  
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    const headerEndIndex = part.indexOf('\r\n\r\n');
    
    if (headerEndIndex === -1) continue;
    
    const headers = part.slice(0, headerEndIndex);
    const content = part.slice(headerEndIndex + 4);
    
    // Check if this part contains a file
    if (headers.includes('filename=') && headers.includes('Content-Type:')) {
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'unknown';
      
      // Remove the trailing \r\n that comes before the next boundary
      const fileContent = content.slice(0, content.length - 2);
      const fileData = Buffer.from(fileContent, 'binary');
      
      return { filename, data: fileData };
    }
  }
  
  return null;
}

// Helper to validate and clean numbers
function validateNumber(value) {
  if (typeof value === 'string') {
    const cleanValue = value.replace(/,/g, '');
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  }
  return typeof value === 'number' ? value : 0;
}

// Helper to prevent double counting of aid
function preventDoubleCounting(parsed) {
  const aidFields = ['financial_aid', 'merit_aid', 'other_aid', 'federal_money', 'workstudy', 'loans'];
  const aidAmounts = {};
  
  // Collect all aid amounts
  aidFields.forEach(field => {
    if (parsed[field] && parsed[field].amount > 0) {
      aidAmounts[field] = parsed[field].amount;
    }
  });
  
  // Check for duplicate amounts (within $100 tolerance)
  const amounts = Object.values(aidAmounts);
  const duplicates = [];
  
  for (let i = 0; i < amounts.length; i++) {
    for (let j = i + 1; j < amounts.length; j++) {
      if (Math.abs(amounts[i] - amounts[j]) <= 100) {
        duplicates.push([amounts[i], amounts[j]]);
      }
    }
  }
  
  // If duplicates found, consolidate them
  if (duplicates.length > 0) {
    console.log("[WARN] Potential double counting detected:", duplicates);
    
    // Find the most common amount
    const amountCounts = {};
    amounts.forEach(amount => {
      amountCounts[amount] = (amountCounts[amount] || 0) + 1;
    });
    
    const mostCommonAmount = Object.keys(amountCounts).reduce((a, b) => 
      amountCounts[a] > amountCounts[b] ? a : b
    );
    
    // Keep the amount in the first field that has it, zero out others
    let kept = false;
    aidFields.forEach(field => {
      if (parsed[field] && parsed[field].amount > 0) {
        if (Math.abs(parsed[field].amount - parseFloat(mostCommonAmount)) <= 100) {
          if (!kept) {
            // Keep this one, but update details to indicate it may include multiple types
            parsed[field].details = `Consolidated aid: ${parsed[field].details || 'Multiple aid types combined'}`;
            kept = true;
          } else {
            // Zero out duplicate
            parsed[field].amount = 0;
            parsed[field].details = 'Consolidated with other aid to prevent double counting';
          }
        }
      }
    });
  }
  
  return parsed;
}

// Helper to validate and fix categorization errors
function validateCategorization(parsed) {
  const issues = [];
  
  // Check for suspicious categorization patterns
  if (parsed.merit_aid && parsed.merit_aid.amount > 0 && parsed.financial_aid && parsed.financial_aid.amount > 0) {
    // If both merit and financial aid have significant amounts, check if they might be the same
    if (Math.abs(parsed.merit_aid.amount - parsed.financial_aid.amount) <= 500) {
      issues.push(`Potential categorization error: Merit aid (${parsed.merit_aid.amount}) and Financial aid (${parsed.financial_aid.amount}) are very similar`);
    }
  }
  
  // Check if total aid exceeds cost of attendance (which would be suspicious)
  const totalAid = (parsed.merit_aid?.amount || 0) + (parsed.financial_aid?.amount || 0) + 
                   (parsed.other_aid?.amount || 0) + (parsed.federal_money?.amount || 0) + 
                   (parsed.workstudy?.amount || 0) + (parsed.loans?.amount || 0);
  
  if (parsed.cost_of_attendance && parsed.cost_of_attendance.amount > 0) {
    if (totalAid > parsed.cost_of_attendance.amount * 1.2) { // Allow 20% buffer
      issues.push(`Total aid (${totalAid}) significantly exceeds cost of attendance (${parsed.cost_of_attendance.amount})`);
    }
  }
  
  // Log any issues found
  if (issues.length > 0) {
    console.log("[WARN] Categorization validation issues:", issues);
  }
  
  return parsed;
}

const analyzeOfferLetter = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Credentials", "true");

  // Handle OPTIONS requests
  if (req.method === "OPTIONS") {
    console.log("[INFO] OPTIONS request handled");
    return res.status(204).send("");
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    console.log(`[ERROR] Method ${req.method} not allowed`);
    return res.status(405).json({
      error: "Method not allowed. Only POST requests are allowed.",
    });
  }

  try {
    console.log("[INFO] Starting offer letter analysis");
    console.log("[INFO] Request content-type:", req.headers['content-type']);

    // Initialize OpenAI client
    let apiKey;
    let openai;
    
    try {
      apiKey = functions.config().openai.api_key;
      openai = new OpenAI({ apiKey });
    } catch (error) {
      console.error("Failed to initialize OpenAI:", error);
      // Fallback for development
      apiKey = process.env.OPENAI_API_KEY;
      openai = new OpenAI({ apiKey });
    }
    console.log("[INFO] OpenAI client initialized");

    // Get the raw body using rawBody which is available in Cloud Functions
    console.log("[INFO] Reading raw request body...");
    const body = req.rawBody || req.body;
    
    if (!body) {
      console.log("[ERROR] No body data received");
      return res.status(400).json({ error: "No data received" });
    }
    
    console.log(`[INFO] Received ${body.length} bytes`);

    // Extract boundary from content-type
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    
    if (!boundaryMatch) {
      console.log("[ERROR] No boundary found in content-type");
      return res.status(400).json({ error: "Invalid multipart data" });
    }
    
    const boundary = boundaryMatch[1];
    console.log(`[INFO] Using boundary: ${boundary}`);

    // Parse the multipart data
    const fileData = parseMultipartData(body, boundary);
    
    if (!fileData) {
      console.log("[ERROR] Could not extract file from multipart data");
      return res.status(400).json({ error: "No file found in request" });
    }

    console.log(`[INFO] Extracted file: ${fileData.filename}, size: ${fileData.data.length} bytes`);
    
    // Default structure for extracted data
    let extractedData = {
      school_name: { name: "" },
      cost_of_attendance: { amount: 0 },
      financial_aid: { amount: 0, details: "" },
      merit_aid: { amount: 0, details: "" },
      other_aid: { amount: 0, details: "" },
      federal_money: { amount: 0, details: "" },
      workstudy: { amount: 0 },
      loans: { amount: 0, details: "" },
      efc_or_sai: { amount: 0 }
    };

    // Process the file based on type
    const fileType = fileData.filename.toLowerCase().split('.').pop();
    
    if (fileType === 'pdf') {
      console.log("[INFO] Processing PDF file");
      try {
        const pdfParseResult = await pdfParse(fileData.data);
        const pdfText = pdfParseResult.text || "";
        console.log(`[INFO] Extracted ${pdfText.length} characters from PDF`);
        
        if (pdfText.length > 0) {
          console.log("[INFO] Sending to OpenAI for analysis...");
          let response, content;
          let retryCount = 0;
          const maxRetries = 2;
          while (retryCount <= maxRetries) {
            try {
              response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                max_tokens: 2000,
                temperature: 0.1,
                messages: [
                {
                  role: "system",
                  content: `You are a financial aid document analyzer. Extract precise financial information from college offer letters.\n\nCRITICAL CATEGORIZATION RULES:\n1. Extract EXACT numbers as they appear - do not round or estimate\n2. Pay special attention to commas in numbers (e.g., 44,674 not 44,442)\n3. CATEGORIZE AID TYPES PRECISELY:\n   - 'Merit Aid': ONLY scholarships/awards based on academic achievement, test scores, GPA, talent, or merit. Look for: "Merit Scholarship", "Academic Scholarship", "Presidential Scholarship", "Dean's Scholarship", "Talent Scholarship", "Honors Award", "Achievement Award", "Non-Need-Based Aid", "Excellence Scholarship", "merit scholarship", "academic scholarship", "presidential scholarship", "dean's scholarship", "honors scholarship", "talent award"\n   - 'Financial Aid': ONLY need-based grants and federal grants. Look for: "Need-Based Grant", "Federal Pell Grant", "Federal SEOG", "Tuition Grant", "State Grant", "Cal Grant", "TAP", "Institutional Grant", "Need-Based Aid", "Need-Based Financial Assistance", "Federal Grant", "need-based grant", "university grant", "college grant", "institutional grant"\n   - 'Federal Money': ONLY federal grants (Pell Grant, FSEOG, TEACH Grant). Look for: "Pell Grant", "Federal Pell", "FSEOG", "Federal Supplemental", "Federal Pell Grant", "Federal SEOG", "Federal Grant"\n   - 'Loans': ONLY loans that must be repaid. Look for: "Direct Subsidized Loan", "Direct Unsubsidized Loan", "Federal Stafford Loan", "Loan Assistance", "PLUS Loan", "Borrow", "Direct Loan", "Parent PLUS", "private loan", "loan"\n   - 'Work Study': ONLY work study programs. Look for: "work study", "work-study", "federal work study"\n   - 'Other Aid': ONLY other scholarships/grants not fitting above (state grants, outside scholarships, etc.)\n4. DO NOT DOUBLE COUNT: Each dollar should only appear in ONE category\n5. If you're unsure about a category, put it in 'Other Aid' rather than guessing\n6. If a number is unclear, return 0 rather than guessing\n7. Always return valid JSON format`
                },
                  {
                    role: "user",
                    content: `Extract financial aid information from this college offer letter. Return a JSON object with these exact fields:\n\n{\n  \"school_name\": {\"name\": \"University Name\"},\n  \"cost_of_attendance\": {\"amount\": total_cost_number, \"details\": \"description if available\"},\n  \"financial_aid\": {\"amount\": need_based_aid_number, \"details\": \"description of aid type\"},\n  \"merit_aid\": {\"amount\": merit_scholarship_number, \"details\": \"description of scholarship\"},\n  \"other_aid\": {\"amount\": other_aid_number, \"details\": \"description of other aid\"},\n  \"federal_money\": {\"amount\": federal_aid_number, \"details\": \"description of federal aid\"},\n  \"workstudy\": {\"amount\": workstudy_number, \"details\": \"description if available\"},\n  \"loans\": {\"amount\": loan_number, \"details\": \"description of loan type\"},\n  \"efc_or_sai\": {\"amount\": expected_family_contribution_number, \"details\": \"description if available\"},\n  \"composite_act\": \"ACT score if present\",\n  \"composite_sat\": \"SAT score if present\", \n  \"gpa\": \"GPA if present\",\n  \"state_of_residence\": \"State abbreviation if present\",\n  \"admission_type\": \"Admission type if present\"\n}\n\nFinancial Aid Document Text:\n${pdfText.substring(0, 8000)}`
                  },
                ],
              });
              content = response.choices[0]?.message?.content;
              break;
            } catch (error) {
              retryCount++;
              if (retryCount > maxRetries) throw error;
              console.log(`[WARN] Retry ${retryCount} for AI parsing`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
          console.log("[INFO] OpenAI response received");
          if (content) {
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                              const parsed = JSON.parse(jsonMatch[0]);
              // Validate all numeric fields
              if (parsed.cost_of_attendance) parsed.cost_of_attendance.amount = validateNumber(parsed.cost_of_attendance.amount);
              if (parsed.financial_aid) parsed.financial_aid.amount = validateNumber(parsed.financial_aid.amount);
              if (parsed.merit_aid) parsed.merit_aid.amount = validateNumber(parsed.merit_aid.amount);
              if (parsed.other_aid) parsed.other_aid.amount = validateNumber(parsed.other_aid.amount);
              if (parsed.federal_money) parsed.federal_money.amount = validateNumber(parsed.federal_money.amount);
              if (parsed.workstudy) parsed.workstudy.amount = validateNumber(parsed.workstudy.amount);
              if (parsed.loans) parsed.loans.amount = validateNumber(parsed.loans.amount);
              if (parsed.efc_or_sai) parsed.efc_or_sai.amount = validateNumber(parsed.efc_or_sai.amount);
              
              // Prevent double counting and validate categorization
              const validatedParsed = validateCategorization(preventDoubleCounting(parsed));
              extractedData = { ...extractedData, ...validatedParsed };
                console.log("[INFO] Successfully parsed and validated financial aid data");
              }
            } catch (parseError) {
              console.log("[WARN] Could not parse JSON from OpenAI response:", parseError.message);
            }
          }
        }
      } catch (pdfError) {
        console.error("[ERROR] PDF processing failed:", pdfError.message);
      }
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType)) {
      console.log("[INFO] Processing image file");
      try {
        const base64File = fileData.data.toString("base64");
        console.log("[INFO] Sending image to OpenAI for analysis...");
        let response, content;
        let retryCount = 0;
        const maxRetries = 2;
        while (retryCount <= maxRetries) {
          try {
            response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              max_tokens: 2000,
              temperature: 0.1,
              messages: [
                {
                  role: "system",
                  content: `You are a financial aid document analyzer. Extract precise financial information from college offer letters.\n\nCRITICAL CATEGORIZATION RULES:\n1. Extract EXACT numbers as they appear - do not round or estimate\n2. Pay special attention to commas in numbers (e.g., 44,674 not 44,442)\n3. CATEGORIZE AID TYPES PRECISELY:\n   - 'Merit Aid': ONLY scholarships/awards based on academic achievement, test scores, GPA, talent, or merit. Look for: "Merit Scholarship", "Academic Scholarship", "Presidential Scholarship", "Dean's Scholarship", "Talent Scholarship", "Honors Award", "Achievement Award", "Non-Need-Based Aid", "Excellence Scholarship", "merit scholarship", "academic scholarship", "presidential scholarship", "dean's scholarship", "honors scholarship", "talent award"\n   - 'Financial Aid': ONLY need-based grants and federal grants. Look for: "Need-Based Grant", "Federal Pell Grant", "Federal SEOG", "Tuition Grant", "State Grant", "Cal Grant", "TAP", "Institutional Grant", "Need-Based Aid", "Need-Based Financial Assistance", "Federal Grant", "need-based grant", "university grant", "college grant", "institutional grant"\n   - 'Federal Money': ONLY federal grants (Pell Grant, FSEOG, TEACH Grant). Look for: "Pell Grant", "Federal Pell", "FSEOG", "Federal Supplemental", "Federal Pell Grant", "Federal SEOG", "Federal Grant"\n   - 'Loans': ONLY loans that must be repaid. Look for: "Direct Subsidized Loan", "Direct Unsubsidized Loan", "Federal Stafford Loan", "Loan Assistance", "PLUS Loan", "Borrow", "Direct Loan", "Parent PLUS", "private loan", "loan"\n   - 'Work Study': ONLY work study programs. Look for: "work study", "work-study", "federal work study"\n   - 'Other Aid': ONLY other scholarships/grants not fitting above (state grants, outside scholarships, etc.)\n4. DO NOT DOUBLE COUNT: Each dollar should only appear in ONE category\n5. If you're unsure about a category, put it in 'Other Aid' rather than guessing\n6. If a number is unclear, return 0 rather than guessing\n7. Always return valid JSON format`
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:image/${fileType};base64,${base64File}`,
                      },
                    },
                    {
                      type: "text",
                      text: `Extract financial aid information from this college offer letter image. Return a JSON object with these exact fields:\n\n{\n  \"school_name\": {\"name\": \"University Name\"},\n  \"cost_of_attendance\": {\"amount\": total_cost_number, \"details\": \"description if available\"},\n  \"financial_aid\": {\"amount\": need_based_aid_number, \"details\": \"description of aid type\"},\n  \"merit_aid\": {\"amount\": merit_scholarship_number, \"details\": \"description of scholarship\"},\n  \"other_aid\": {\"amount\": other_aid_number, \"details\": \"description of other aid\"},\n  \"federal_money\": {\"amount\": federal_aid_number, \"details\": \"description of federal aid\"},\n  \"workstudy\": {\"amount\": workstudy_number, \"details\": \"description if available\"},\n  \"loans\": {\"amount\": loan_number, \"details\": \"description of loan type\"},\n  \"efc_or_sai\": {\"amount\": expected_family_contribution_number, \"details\": \"description if available\"},\n  \"composite_act\": \"ACT score if present\",\n  \"composite_sat\": \"SAT score if present\", \n  \"gpa\": \"GPA if present\",\n  \"state_of_residence\": \"State abbreviation if present\",\n  \"admission_type\": \"Admission type if present\"\n}`
                    },
                  ],
                },
              ],
            });
            content = response.choices[0]?.message?.content;
            break;
          } catch (error) {
            retryCount++;
            if (retryCount > maxRetries) throw error;
            console.log(`[WARN] Retry ${retryCount} for AI parsing (image)`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
        console.log("[INFO] OpenAI vision response received");
        if (content) {
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              // Validate all numeric fields
              if (parsed.cost_of_attendance) parsed.cost_of_attendance.amount = validateNumber(parsed.cost_of_attendance.amount);
              if (parsed.financial_aid) parsed.financial_aid.amount = validateNumber(parsed.financial_aid.amount);
              if (parsed.merit_aid) parsed.merit_aid.amount = validateNumber(parsed.merit_aid.amount);
              if (parsed.other_aid) parsed.other_aid.amount = validateNumber(parsed.other_aid.amount);
              if (parsed.federal_money) parsed.federal_money.amount = validateNumber(parsed.federal_money.amount);
              if (parsed.workstudy) parsed.workstudy.amount = validateNumber(parsed.workstudy.amount);
              if (parsed.loans) parsed.loans.amount = validateNumber(parsed.loans.amount);
              if (parsed.efc_or_sai) parsed.efc_or_sai.amount = validateNumber(parsed.efc_or_sai.amount);
              
              // Prevent double counting and validate categorization
              const validatedParsed = validateCategorization(preventDoubleCounting(parsed));
              extractedData = { ...extractedData, ...validatedParsed };
              console.log("[INFO] Successfully parsed and validated financial aid data from image");
            }
          } catch (parseError) {
            console.log("[WARN] Could not parse JSON from OpenAI response (image):", parseError.message);
          }
        }
      } catch (imageError) {
        console.error("[ERROR] Image processing failed:", imageError.message);
      }
    } else {
      return res.status(400).json({ error: `Unsupported file type: ${fileType}` });
    }

    console.log("[INFO] Analysis completed successfully");
    return res.status(200).json({ structuredData: extractedData });

  } catch (error) {
    console.error("[ERROR] Analysis failed:", error);
    console.error("[ERROR] Stack trace:", error.stack);
    return res.status(500).json({
      error: "Analysis failed",
      details: error.message
    });
  }
});

module.exports = {
  analyzeOfferLetter,
};
