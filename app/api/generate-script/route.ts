import { NextRequest, NextResponse } from "next/server";
import { generateAppsScript } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const { templateType, customPrompt } = await req.json();

    if (!templateType && !customPrompt) {
      return NextResponse.json(
        { error: "templateType or customPrompt is required" },
        { status: 400 }
      );
    }

    const result = await generateAppsScript(templateType, customPrompt);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating script:", error);
    return NextResponse.json(
      { error: "Failed to generate script" },
      { status: 500 }
    );
  }
}
