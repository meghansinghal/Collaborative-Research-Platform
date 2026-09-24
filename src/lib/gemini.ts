import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.6-flash';

if (!apiKey) {
  console.error('Missing Gemini API key');
  throw new Error('Please add your Gemini API key to the environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });

function getGeminiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Gemini request failed';

  if (message.includes('429') || message.toLowerCase().includes('quota exceeded')) {
    return 'Gemini API quota is unavailable for the current Google AI Studio project. Check that the API key belongs to the intended project, verify the project shows a non-zero rate limit in AI Studio, and enable billing if the free tier is not available for that project or region.';
  }

  return message;
}

export async function summarizePaper(text: string): Promise<string> {
  const prompt = `Please provide a comprehensive summary of the following research paper. Focus on the main findings, methodology, and conclusions. Give pre formatted text as output. Here's the paper text:\n\n${text}`;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: unknown) {
    const message = getGeminiErrorMessage(error);
    console.error('Error summarizing paper:', message);
    throw new Error(message);
  }
}

export async function answerQuestion(text: string, question: string): Promise<string> {
  const prompt = `Using the context of the following research paper, please answer this question: "${question}"
  
  Paper text:\n\n${text}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: unknown) {
    const message = getGeminiErrorMessage(error);
    console.error('Error answering question:', message);
    throw new Error(message);
  }
}

export async function getSuggestions(paperText: string, annotation: string): Promise<string> {
  if (!paperText || !annotation) {
    throw new Error('Missing paper text or annotation');
  }

  try {
    const prompt = `You are an experienced research mentor providing feedback on a student's annotation of a research paper. 

Context:
Paper: "${paperText.slice(0, 2000)}..."
Student's Annotation: "${annotation}"

As their mentor, please provide:
1. A brief analysis of their perspective and how it relates to the paper's content
2. 2-3 specific suggestions for deepening their analysis
3. Potential research directions they could explore based on their interests
4. Areas where they could contribute novel insights to the field

Keep the tone supportive yet professional, as if you're a senior researcher mentoring a promising junior colleague.`;
    
    const result = await model.generateContent(prompt);
    if (!result.response) {
      throw new Error('No response received from Gemini API');
    }
    return result.response.text();
  } catch (error: any) {
    const message = getGeminiErrorMessage(error);
    console.error('Error in getSuggestions:', message);
    throw new Error(message);
  }
}
