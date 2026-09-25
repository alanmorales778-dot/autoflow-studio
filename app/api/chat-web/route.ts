import { NextRequest, NextResponse } from "next/server";
import { processWebChatMessage, DEFAULT_WEB_STATE } from "@/lib/ai";
import { prisma } from "@/lib/db";

// POST: Process chat message
export async function POST(req: NextRequest) {
  try {
    const { message, currentState, messageHistory } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const state = currentState || DEFAULT_WEB_STATE;
    const history = messageHistory || [];

    const result = await processWebChatMessage(message, state, history);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing chat:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// PUT: Save/finalize web project
export async function PUT(req: NextRequest) {
  try {
    const { projectState, chatHistory, clientEmail, clientName, clientPhone } =
      await req.json();

    if (!clientEmail) {
      return NextResponse.json(
        { error: "clientEmail is required" },
        { status: 400 }
      );
    }

    const project = await prisma.webProject.create({
      data: {
        businessName: projectState?.businessName || "Sin nombre",
        niche: projectState?.niche || null,
        sections: JSON.stringify(projectState?.sections || []),
        colorPalette: JSON.stringify(projectState?.colorPalette || {}),
        tone: projectState?.tone || null,
        wireframeJson: JSON.stringify(projectState || {}),
        chatHistory: JSON.stringify(chatHistory || []),
        status: "STAND_BY",
        clientName: clientName || null,
        clientEmail: clientEmail,
        clientPhone: clientPhone || null,
      },
    });

    return NextResponse.json({
      success: true,
      projectId: project.id,
    });
  } catch (error) {
    console.error("Error saving project:", error);
    return NextResponse.json(
      { error: "Failed to save project" },
      { status: 500 }
    );
  }
}
