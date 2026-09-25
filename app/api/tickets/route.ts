import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: List all tickets
export async function GET() {
  try {
    const tickets = await prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST: Create a new ticket
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const ticket = await prisma.ticket.create({
      data: {
        type: body.type || "complex",
        clientName: body.clientName || "Anónimo",
        clientEmail: body.clientEmail || "",
        description: body.description || "",
        tools: body.tools || null,
        volume: body.volume || null,
        objective: body.objective || null,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}
