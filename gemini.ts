import { GoogleGenAI, Content, Part, ThinkingLevel } from "@google/genai";

let history: Content[] = [];

const SYSTEM_INSTRUCTION = `You are 'Accessibility Fun', an expert chatbot assistant specializing in web and software accessibility. You have deep knowledge of WCAG 2.0, 2.1, 2.2, Section 508, ADA, and automated tools like Lighthouse, Axe, and ARC Toolkit. You are also an expert in assistive technologies like NVDA, JAWS, and VoiceOver across different environments (Android, Mac, iOS, Windows).

When answering questions, you MUST prioritize and fetch information from the following authoritative sources using the provided URL Context tool:
- https://www.w3.org/WAI/WCAG22/Understanding/
- https://www.w3.org/WAI/ARIA/apg/patterns/
- https://www.access-board.gov/ict/
- https://web.dev/learn/accessibility
- https://material.angular.dev/components/categories
- https://www.deque.com/

Provide step-by-step guides, code examples, decision trees, and sufficient techniques to resolve issues. If asked about color contrast, calculate it if possible or explain how to test it. Be encouraging and provide talking points to advocate for accessibility when asked.

If the user asks about specific keystrokes for JAWS, NVDA, or VoiceOver, provide them accurately. If they ask to evaluate alt text, provide constructive feedback.

If the user uploads an image, analyze it for accessibility issues (e.g., color contrast, missing alt text context, complex images needing description, text in images).

Always format your responses using Markdown for readability.`;

export function initChat() {
  history = [];
}

export function setChatHistory(messages: any[]) {
  history = messages.map(msg => {
    const parts: Part[] = [];
    if (msg.content) {
      parts.push({ text: msg.content });
    }
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach((att: any) => {
        if (att.mimeType && att.data) {
          parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
        }
      });
    }
    if (parts.length === 0) {
      parts.push({ text: " " });
    }
    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts
    };
  });
}

const ACCESSIBILITY_URLS = [
  "https://www.w3.org/WAI/WCAG22/Understanding/",
  "https://www.w3.org/WAI/ARIA/apg/patterns/",
  "https://www.access-board.gov/ict/",
  "https://web.dev/learn/accessibility",
  "https://material.angular.dev/components/categories",
  "https://www.deque.com/"
];

export async function sendMessageStream(
  message: string,
  attachments: { mimeType: string; data: string }[],
  onChunk: (text: string) => void
) {
  // Ensure API key is present and valid
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("API Key length:", apiKey ? apiKey.length : 0);
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    console.error("GEMINI_API_KEY is missing or undefined in the environment.");
    throw new Error("API key is missing. Please ensure your Gemini API key is set in the AI Studio settings.");
  }

  // Initialize AI instance here to ensure it's always fresh and picks up environment variables
  const ai = new GoogleGenAI({ apiKey });

  const parts: Part[] = [];
  if (message) {
    parts.push({ text: message });
  }
  for (const att of attachments) {
    parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
  }

  if (parts.length === 0) {
    parts.push({ text: " " });
  }

  const userContent: Content = { role: "user", parts };
  
  // Filter history to ensure alternating roles and no trailing user message if we're adding one
  const cleanedHistory = history.filter((msg, index) => {
    // Ensure we don't have two identical consecutive messages (common if setChatHistory is called mid-stream)
    if (index > 0 && JSON.stringify(msg.parts) === JSON.stringify(history[index-1].parts)) {
      return false;
    }
    return true;
  });

  // Append accessibility URLs to the first user message to trigger URL Context tool
  if (cleanedHistory.length === 0) {
    const urlNote = `\n\n(Authoritative Sources for Context: ${ACCESSIBILITY_URLS.join(", ")})`;
    if (parts[0] && 'text' in parts[0]) {
      parts[0].text += urlNote;
    }
  }

  // If the last message in history is a user message, we should probably append to it or replace it
  // But standard Gemini expects User -> Model -> User.
  // If history ends with 'user', we remove it because we are providing the 'userContent' separately
  if (cleanedHistory.length > 0 && cleanedHistory[cleanedHistory.length - 1].role === 'user') {
    cleanedHistory.pop();
  }

  // Limit history to last 10 messages to keep response times high and costs low
  const limitedHistory = cleanedHistory.slice(-10);

  const currentContents = [...limitedHistory, userContent];

  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-flash-latest",
        contents: currentContents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [
            { urlContext: {} },
            { googleSearch: {} }
          ]
        },
      });

      let fullResponse = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullResponse += chunk.text;
          await onChunk(chunk.text);
        }
      }

      history.push(userContent);
      history.push({ role: "model", parts: [{ text: fullResponse }] });
      return; // Success
    } catch (error: any) {
      retryCount++;
      console.error(`Error sending message to Gemini (Attempt ${retryCount}):`, error);
      
      // If it's an API key error, don't retry, just throw
      const errorMsg = error.message || "";
      if (errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('not found')) {
        throw new Error(`API Error: ${errorMsg}`);
      }

      if (retryCount > maxRetries) {
        throw new Error(`API Error after retries: ${errorMsg}`);
      }
      
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
}
