import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Change from default export to named export
export async function POST(request) {
    try {
        const { message } = await request.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // create chat thread
        const thread = await openai.beta.threads.create();

        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: "asst_SZnr1M8la5EriKL73vd6TeWu" // Your actual assistant ID
        });

        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

        while(runStatus.status !== 'completed')
        {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

            // Handle failed runs
            if (["failed", "cancelled", "expired"].includes(runStatus.status)) {
                throw new Error(`Run ended with status: ${runStatus.status}`);
            }
        }

        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantmessages = messages.data.filter(msg=> msg.role === 'assistant');

        const latest = assistantmessages[0];

        const responseContent = latest.content[0].text.value;

        return NextResponse.json({ response: responseContent });

        // Use a valid model name instead of an assistant ID
        // const completion = await openai.chat.completions.create({
        //     model: "gpt-3.5-turbo", // Change this to a valid model name
        //     messages: [
        //         { role: "system", content: "You are a helpful assistant." },
        //         { role: "user", content: message }
        //     ]
        // });
        //
        // const responseContent = completion.choices[0].message.content;
        //
        // console.log("OpenAI response:", responseContent);
        //
        // return NextResponse.json({ response: responseContent });

    } catch (error) {
        console.error("OpenAI API error:", error);
        // Fix the response handling in the catch block
        return NextResponse.json(
            { error: "An error occurred while processing your request" },
            { status: 500 }
        );
    }
}