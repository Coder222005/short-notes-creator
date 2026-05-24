const { queryLLM } = require('./llmService');

/**
 * Note Service
 * Manages notes extraction prompt engineering and response parsing.
 */
async function processAndAppendNotes({ message, chatHistory, currentNotes, llmConfig }) {
  const systemPrompt = `You are a premium, highly effective Study Assistant. Your goal is to help the user study and build a comprehensive, structured study notebook.

When the user sends study materials, notes, or questions, you must:
1. Review the input.
2. Provide a conversational, encouraging explanation, answer questions, or ask a clarifying question in the "chat_response".
3. Extract key structured notes (definitions, main concepts, bullet points, formula lists, or summaries) in the "extracted_notes" field. The notes should be written in clean Markdown.

You MUST respond in this exact JSON format:
{
  "chat_response": "Your conversational explanation, answers, and study support. Keep it engaging, clear, and educational.",
  "extracted_notes": "The structured notes you extracted to append to the notebook. Use Markdown headers (h3 or h4, since h1/h2 are used for titles), lists, bold words, and blockquotes. Only include actual notes here, not conversational text. If no new important facts were introduced, leave this as an empty string."
}

Important Rules:
- Do NOT output any conversational text outside the JSON object.
- Make sure "extracted_notes" is written as clean, renderable Markdown.
- To avoid duplicating existing notes, review the current notes context:
--- CURRENT NOTEBOOK NOTES ---
${currentNotes}
------------------------------
Only extract NEW information or provide a more detailed structure for existing items, avoiding exact duplicates.`;

  try {
    const rawResponse = await queryLLM({
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      model: llmConfig.model,
      messages: chatHistory,
      systemPrompt: systemPrompt
    });

    // Parse the JSON response resiliently
    let parsed;
    try {
      // Find JSON block if LLM wrapped it in markdown code fences
      let jsonText = rawResponse.trim();
      const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
      const match = jsonText.match(jsonRegex);
      if (match) {
        jsonText = match[1];
      }
      
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn("Failed to parse LLM response as JSON. Raw response was:", rawResponse);
      
      // Resilient fallback parser:
      // If LLM returned raw text, let's treat the entire thing as the chat response,
      // and look for any markdown sections to split or just keep extracted_notes empty.
      parsed = {
        chat_response: rawResponse,
        extracted_notes: ""
      };

      // Heuristic: If there are markdown lists/headers in the text, let's copy them to notes
      if (rawResponse.includes('###') || rawResponse.includes('* ') || rawResponse.includes('- ')) {
        // Find the first occurrence of a header or list and extract it
        const firstHeaderIdx = rawResponse.indexOf('###');
        if (firstHeaderIdx !== -1) {
          parsed.chat_response = rawResponse.substring(0, firstHeaderIdx).trim();
          parsed.extracted_notes = rawResponse.substring(firstHeaderIdx).trim();
        }
      }
    }

    return {
      reply: parsed.chat_response || "Study notes updated!",
      notesToAppend: parsed.extracted_notes || ""
    };

  } catch (error) {
    console.error("Error in processAndAppendNotes:", error);
    throw error;
  }
}

module.exports = {
  processAndAppendNotes
};
