const { queryLLM } = require('./llmService');

/**
 * Note Service
 * Manages notes extraction, tutoring prompts, sliding windows, and interactive quiz formatting.
 */
async function processAndAppendNotes({ message, chatHistory, currentNotes, llmConfig, mode = 'compile' }) {
  let systemPrompt = '';
  let activeHistory = [];

  if (mode === 'compile') {
    // 1. Filter out messages before the last accepted notes draft
    let filteredHistory = [...chatHistory];
    const lastAcceptedIndex = [...chatHistory].reverse().findIndex(
      m => m.role === 'assistant' && m.notesAdded === true
    );
    
    if (lastAcceptedIndex !== -1) {
      // Convert reverse index back to standard index
      const actualIndex = chatHistory.length - 1 - lastAcceptedIndex;
      filteredHistory = chatHistory.slice(actualIndex + 1);
    }

    // 2. Sliding window of last 4 messages (2 user turns)
    activeHistory = filteredHistory.slice(-4);

    systemPrompt = `You are a premium, highly effective Study Assistant. Your goal is to help the user build a structured study notebook.

Review the current notes content:
--- CURRENT NOTEBOOK NOTES ---
${currentNotes}
------------------------------

The user is in NOTE-TAKING mode. They will feed study materials, details, or instruct you to modify, add, reorganize, or delete specific points in their notes.

Your job:
1. Review their input/instruction.
2. Generate the ENTIRE updated study notes content in the "extracted_notes" field in clean Markdown. This must be the full notes document, combining any existing notes (from the CURRENT NOTEBOOK NOTES section above) with the new updates, additions, deletions, or modifications.
3. Do NOT include the main notebook title header (e.g. "# title") or any welcome placeholders at the very top of "extracted_notes", as the system manages the main notebook title. Start directly with the content headings (e.g. "## Mitosis" or "### Core Concepts").
4. In "chat_response", provide a very brief, 1-2 sentence confirmation of what notes were generated/updated (e.g., "Added photosynthesis formula under light reactions."). Do NOT write long explanations, doubts, or tutoring text. Keep it strictly focused on the compilation status. Do NOT ask clarifying questions or engage in casual conversation.

You MUST respond in this exact JSON format:
{
  "chat_response": "A brief, 1-sentence confirmation of the notes update.",
  "extracted_notes": "The complete structured markdown notes representing the updated document."
}`;
  } else {
    // mode === 'study'
    // 1. Sliding window of last 2 messages (1 user turn)
    activeHistory = chatHistory.slice(-2);

    systemPrompt = `You are a premium, highly effective Study Assistant. Your goal is to help the user study and test their knowledge of the compiled study notes.

Review the notes content:
--- CURRENT NOTEBOOK NOTES ---
${currentNotes}
------------------------------

Your job:
1. Answer the user's questions, clear their doubts, or test/quiz them based ONLY or PRIMARILY on the compiled notes.
2. Keep it engaging, educational, and clear.
3. Do NOT extract any new study notes. The "extracted_notes" field in your response must be an empty string.
4. If the user asks for a quiz, test, or to check their knowledge, you must generate a multiple-choice quiz. Write the quiz questions inside a markdown code block tagged with "quiz", containing a JSON object in this exact format:
\`\`\`quiz
{
  "questions": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "solution": "Detailed explanation of why this answer is correct and why other options are incorrect.",
      "concept": "The core concept being tested (e.g., Calvin Cycle, Light Reactions)"
    }
  ]
}
\`\`\`
Ensure the options array contains 2 to 4 options, and answerIndex is the 0-indexed position of the correct answer. Provide 1 to 5 questions in the quiz. Do NOT put other texts inside the \`\`\`quiz block, only the valid JSON.

You MUST respond in this exact JSON format:
{
  "chat_response": "Your tutoring explanation, answer, or quiz intro here. Feel free to explain concepts or review the user's answers.",
  "extracted_notes": ""
}`;
  }

  try {
    const rawResponse = await queryLLM({
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      model: llmConfig.model,
      messages: activeHistory,
      systemPrompt: systemPrompt
    });

    // Parse the JSON response resiliently
    let parsed;
    try {
      let jsonText = rawResponse.trim();
      if (jsonText.startsWith('```')) {
        const firstLineEnd = jsonText.indexOf('\n');
        const lastFenceIdx = jsonText.lastIndexOf('```');
        if (firstLineEnd !== -1 && lastFenceIdx > firstLineEnd) {
          jsonText = jsonText.substring(firstLineEnd, lastFenceIdx).trim();
        }
      }
      
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn("Failed to parse LLM response as JSON. Raw response was:", rawResponse);
      
      parsed = {
        chat_response: rawResponse,
        extracted_notes: ""
      };

      // Heuristic: If compile mode and there are markdown lists/headers in the text, extract it
      if (mode === 'compile' && (rawResponse.includes('###') || rawResponse.includes('* ') || rawResponse.includes('- '))) {
        const firstHeaderIdx = rawResponse.indexOf('###');
        if (firstHeaderIdx !== -1) {
          parsed.chat_response = rawResponse.substring(0, firstHeaderIdx).trim();
          parsed.extracted_notes = rawResponse.substring(firstHeaderIdx).trim();
        }
      }
    }

    // Mode-aware response routing and fallback defaults
    if (mode === 'study') {
      let replyContent = (parsed.chat_response || "").trim();
      // If LLM mistakenly placed the quiz or tutorial content in extracted_notes, move it to reply
      if (parsed.extracted_notes && parsed.extracted_notes.trim() !== "") {
        replyContent = replyContent ? replyContent + "\n\n" + parsed.extracted_notes.trim() : parsed.extracted_notes.trim();
      }
      return {
        reply: replyContent || "Here is the response to help you study:",
        notesToAppend: ""
      };
    } else {
      // mode === 'compile'
      return {
        reply: parsed.chat_response || "Proposed study notes draft generated.",
        notesToAppend: parsed.extracted_notes || ""
      };
    }

  } catch (error) {
    console.error("Error in processAndAppendNotes:", error);
    throw error;
  }
}

module.exports = {
  processAndAppendNotes
};
