import fs from "fs";
import path from "path";

const API_BASE = `http://127.0.0.1:${process.env.API_PORT || 3000}`;

async function uploadLogo(imagePath: string, storeName: string, storeId: number) {
  console.log(`\nUploading logo for ${storeName} (store ${storeId})...`);
  
  // Read image as base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  const dataUri = `data:${mimeType};base64,${base64}`;
  
  // Upload via stores.uploadLogo
  const uploadRes = await fetch(`${API_BASE}/api/trpc/stores.uploadLogo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { base64: dataUri, mimeType } }),
  });
  
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload failed for ${storeName}: ${text}`);
  }
  
  const uploadData = await uploadRes.json() as any;
  const logoUrl = uploadData.result?.data?.json?.url;
  
  if (!logoUrl) {
    throw new Error(`No URL returned for ${storeName}: ${JSON.stringify(uploadData)}`);
  }
  
  console.log(`  Uploaded to: ${logoUrl}`);
  
  // Update store logo in database
  const updateRes = await fetch(`${API_BASE}/api/trpc/admin.updateStoreLogo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { storeId, logoUrl } }),
  });
  
  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`Update failed for ${storeName}: ${text}`);
  }
  
  console.log(`  ✅ ${storeName} logo updated successfully!`);
  return logoUrl;
}

async function main() {
  try {
    // AppleGreen - store ID 3
    await uploadLogo("/home/ubuntu/upload/applegreenlogo.jpg", "AppleGreen Balbriggan", 3);
    
    // Treasure Bowl - store ID 6
    await uploadLogo("/home/ubuntu/upload/treasurebowllogo.jpg", "Treasure Bowl Balbriggan", 6);
    
    console.log("\n✅ All logos uploaded successfully!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
