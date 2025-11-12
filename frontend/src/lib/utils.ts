import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ethers } from "ethers";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to decode URL-safe Base64 to Hex string
export function decodeBase64To32Bytes(base64String: string) {
  // Convert URL-safe Base64 to regular Base64 (replace '-' with '+' and '_' with '/')
  const standardBase64 = base64String.replace(/-/g, '+').replace(/_/g, '/');

  // Decode the Base64 string into bytes
  const decodedBytes = Buffer.from(standardBase64, 'base64');

  // Convert the bytes into a valid hex string using ethers
  let hexString = ethers.hexlify(decodedBytes);

  // hexString = encode72to64(hexString)
  // console.log(hexString)
  const bytesFromHex = ethers.keccak256(hexString)

  return bytesFromHex;
}