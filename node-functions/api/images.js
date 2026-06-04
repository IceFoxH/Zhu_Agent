export async function onRequestGet(context) {
  const IMAGE_FILES = ["pic1.jpg", "pic2.jpg", "pic3.jpg"];
  return new Response(JSON.stringify(IMAGE_FILES), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
