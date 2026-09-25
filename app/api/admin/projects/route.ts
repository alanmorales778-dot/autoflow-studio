import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: List all web projects (for admin panel)
export async function GET() {
  try {
    const projects = await prisma.webProject.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json([], { status: 200 });
  }
}
