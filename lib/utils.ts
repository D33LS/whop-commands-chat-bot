/**
 * Format a date from a Unix timestamp to a readable string
 * @param unixTimestamp The Unix timestamp (in seconds or milliseconds)
 * @returns Formatted date string
 */
export function formatDate(unixTimestamp: number | string): string {
  try {
    let timestamp =
      typeof unixTimestamp === "string"
        ? parseInt(unixTimestamp, 10)
        : unixTimestamp;

    if (timestamp < 10000000000) {
      timestamp = timestamp * 1000;
    }

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };

    if (diffDays < 180) {
      return `${date.toLocaleDateString(
        "en-US",
        options
      )} (${diffDays} days ago)`;
    } else {
      return date.toLocaleDateString("en-US", options);
    }
  } catch (error) {
    console.error("Error formatting date:", error, unixTimestamp);
    return "Unknown date";
  }
}

/**
 * Format a number with commas and proper decimal places
 * @param num The number to format
 * @param decimalPlaces The number of decimal places to include
 * @returns A formatted string
 */
export function formatNumberWithCommas(
  num: number,
  decimalPlaces: number = 2
): string {
  const fixed = num.toFixed(decimalPlaces);
  const parts = fixed.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return parts.join(".");
}

/**
 * Format a currency value with dollar sign
 * @param amount The amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in ms
 * @returns Promise with the function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 500
): Promise<T> {
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (retries >= maxRetries) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, retries);
      console.log(`Retry ${retries + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      retries++;
    }
  }
}
