import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PIC_DIR = path.join(__dirname, "../../pic");

export async function onRequestGet(context) {
  try {
    if (!fs.existsSync(PIC_DIR)) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const files = fs
      .readdirSync(PIC_DIR)
      .filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .sort();
    return new Response(JSON.stringify(files), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("读取图片目录失败:", err.message);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
