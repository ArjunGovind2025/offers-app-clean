// A utility for conditionally joining class names
export function cn(...classes) {
    return classes.filter(Boolean).join(" ");
  }
  
  // A utility to format numbers with commas (e.g., 1234567 -> "1,234,567")
  export function formatNumber(value) {
    if (!value) return "0";
    const number = typeof value === "number" ? value : parseFloat(value);
    return isNaN(number) ? "0" : number.toLocaleString();
  }
  
  // A utility to capitalize the first letter of a string
  export function capitalizeFirstLetter(string) {
    if (!string) return "";
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  
  // A utility to truncate a string to a specified length
  export function truncate(string, maxLength) {
    if (!string || string.length <= maxLength) return string;
    return `${string.slice(0, maxLength)}...`;
  }
  
  // A utility to format dates (e.g., "2025-01-10" -> "Jan 10, 2025")
  export function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  
  // A utility to debounce a function (useful for limiting API calls)
  export function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
  
  // A utility to deep clone an object (avoids mutating the original)
  export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  
  // A utility to generate a random string (e.g., for unique keys)
  export function randomString(length = 8) {
    return Math.random().toString(36).substr(2, length);
  }
  