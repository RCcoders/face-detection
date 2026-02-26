/* ── Emotion jokes/lines ── */
export const EMOTION_JOKES: Record<string, string[]> = {
    Happy: [
        "Who hurt you? Because it clearly wasn't today.",
        "That smile looks suspicious. Did something actually go right?",
        "You look like life finally replied to your 'it is what it is'.",
        "Happiness detected. Screenshot this moment.",
        "You look like you just survived an exam you didn't study for.",
        "That face says 'I'm winning', even if you're not.",
        "Someone's serotonin showed up for work today.",
        "You look like your playlist just hit the perfect song.",
        "Careful — this much happiness might confuse your friends.",
        "Enjoy this mood. It has limited availability.",
    ],
    Sad: [
        "You look like life said 'character development' and meant it.",
        "It's okay to be sad. Everyone's villain arc starts somewhere.",
        "Your face says 'I laughed today, but not sincerely'.",
        "Sad detected. Happens when expectations meet reality.",
        "You look like you're tired, not sad — which is worse.",
        "It's fine. Even legends have low stats sometimes.",
        "This is not rock bottom. There's Wi-Fi here.",
        "You look like you need sleep, food, and less responsibility.",
        "Sadness detected. Don't worry, it usually leaves without notice.",
        "You're allowed to feel like this. Society is exhausting.",
    ],
    Stressed: [
        "You look like your brain has 47 tabs open and music playing from one you can't find.",
        "Stress detected. Congratulations, you're officially an adult now.",
        "You look calm… in the same way a computer looks calm before crashing.",
        "Relax. Whatever you're stressed about will still be there tomorrow.",
        "Your face says 'I need sleep', your schedule says 'absolutely not'.",
        "Stress level high. Motivation level missing.",
        "You're not stressed — you're just aggressively overthinking.",
        "It's okay. Even Google doesn't have all the answers.",
        "Your brain is running on low battery and vibes.",
        "You look like you said 'I'll do it later' and now it's later.",
    ],
    Neutral: [
        "Emotion detected: 'I'm just here'.",
        "Ah yes. The 'nothing's wrong but everything's annoying' face.",
        "You look like you're emotionally buffering.",
        "Neutral detected. Personality loading…",
        "That face says 'I didn't sleep but I showed up'.",
        "You look like life is happening to you.",
        "Mood status: alive, unfortunately.",
        "Emotion level: functioning member of society.",
        "You look like you replied 'ok' but meant 12 things.",
        "Just existing. No free trial included.",
    ],
    Surprised: [
        "You look like the code actually worked on the first try.",
        "That face when the deadline is today, not tomorrow.",
        "You look like you just saw your screen time report.",
        "Surprise detected. Did someone actually reply to your email?",
        "You look like you just found money in an old jeans pocket.",
        "That expression says 'I wasn't ready for this plot twist'.",
        "Shock detected. Did the WiFi just connect automatically?",
        "You look like you just realized it's Monday effectively.",
        "That face when the bug was a missing semicolon.",
        "You look like you just heard your own voice recording.",
    ],
    Angry: [
        "Who touched your code? I just want to talk.",
        "You look like a merge conflict waiting to happen.",
        "That face says 'it works on my machine' but it didn't.",
        "Anger detected. Do you need a hug or a punching bag?",
        "You look like you just read the comments section.",
        "Resting rage face detected. Proceed with caution.",
        "You look like 404 Error: Patience Not Found.",
        "That expression says 'I am one minor inconvenience away from snapping'.",
        "You look like someone who just stepped on a wet floor in socks.",
        "Anger loading... Please wait or run away.",
    ],
};

const usedJokes: Record<string, Set<number>> = {};

export function pickJoke(emotion: string): string {
    const jokes = EMOTION_JOKES[emotion] || EMOTION_JOKES.Neutral;
    const key = emotion;

    if (!usedJokes[key]) usedJokes[key] = new Set();

    if (usedJokes[key].size >= jokes.length) {
        usedJokes[key].clear();
    }

    let idx: number;
    do {
        idx = Math.floor(Math.random() * jokes.length);
    } while (usedJokes[key].has(idx));

    usedJokes[key].add(idx);
    return jokes[idx];
}
