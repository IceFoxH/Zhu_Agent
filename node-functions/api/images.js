const fs = require("fs");
const path = require("path");

export async function onRequestGet(context) {
  try {
    const picDir = path.join(__dirname, "../../pic");
    if (!fs.existsSync(picDir)) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const files = fs.readdirSync(picDir)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .sort();
    return new Response(JSON.stringify(files), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
