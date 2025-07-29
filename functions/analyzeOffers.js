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
    const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });
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
          const response = await openai.chat.completions.create({
            model: "gpt-4",
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: `Extract financial aid information from this college offer letter. Return a JSON object with these exact fields:
{
  "school_name": {"name": "University Name"},
  "cost_of_attendance": {"amount": total_cost_number},
  "financial_aid": {"amount": total_aid_number, "details": "description"},
  "merit_aid": {"amount": merit_scholarship_number, "details": "description"},
  "other_aid": {"amount": other_aid_number, "details": "description"},
  "federal_money": {"amount": federal_aid_number, "details": "description"},
  "workstudy": {"amount": workstudy_number},
  "loans": {"amount": loan_number, "details": "description"},
  "efc_or_sai": {"amount": expected_family_contribution_number}
}

Financial Aid Document Text:
${pdfText.substring(0, 4000)}`
              },
            ],
          });

          const content = response.choices[0]?.message?.content;
          console.log("[INFO] OpenAI response received");
          
          if (content) {
            try {
              // Try to parse JSON from the response
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                extractedData = { ...extractedData, ...parsed };
                console.log("[INFO] Successfully parsed financial aid data");
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
        
        const response = await openai.chat.completions.create({
          model: "gpt-4-vision-preview",
          max_tokens: 1000,
          messages: [
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
                  text: `Extract financial aid information from this college offer letter image. Return a JSON object with these exact fields:
{
  "school_name": {"name": "University Name"},
  "cost_of_attendance": {"amount": total_cost_number},
  "financial_aid": {"amount": total_aid_number, "details": "description"},
  "merit_aid": {"amount": merit_scholarship_number, "details": "description"},
  "other_aid": {"amount": other_aid_number, "details": "description"},
  "federal_money": {"amount": federal_aid_number, "details": "description"},
  "workstudy": {"amount": workstudy_number},
  "loans": {"amount": loan_number, "details": "description"},
  "efc_or_sai": {"amount": expected_family_contribution_number}
}`
                },
              ],
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        console.log("[INFO] OpenAI vision response received");
        
        if (content) {
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              extractedData = { ...extractedData, ...parsed };
              console.log("[INFO] Successfully parsed financial aid data from image");
            }
          } catch (parseError) {
            console.log("[WARN] Could not parse JSON from OpenAI response:", parseError.message);
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
