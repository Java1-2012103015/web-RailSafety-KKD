const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();
  try {
    const r = await p.notice.create({
      data: {
        title: "test",
        content: "test content",
        authorName: "admin",
        boardType: "NOTICE",
        postedAt: new Date("2026-06-18"),
        visible: true,
      },
    });
    console.log("ok", r.id);
    await p.notice.delete({ where: { id: r.id } });
  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    await p.$disconnect();
  }
}

main();
