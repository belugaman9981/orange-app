// Built-in training data for the ticket-triage demo, plus a pool of
// unlabeled tickets used to demonstrate active learning.

export const questions = {
  sentiment: { type: "choice", options: ["angry", "neutral", "happy"] },
  urgency: { type: "score", min: 0, max: 10 },
  needsEscalation: { type: "bool" },
} as const;

export type TicketLabels = {
  sentiment: "angry" | "neutral" | "happy";
  urgency: number;
  needsEscalation: boolean;
};

export interface TicketExample {
  state: string;
  labels: TicketLabels;
}

export const trainingData: TicketExample[] = [
  { state: "Still no refund after 2 weeks, this is ridiculous.", labels: { sentiment: "angry", urgency: 9, needsEscalation: true } },
  { state: "Thanks, that answers my question!", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "Where is my order, it's been a month!", labels: { sentiment: "angry", urgency: 8, needsEscalation: true } },
  { state: "This is the third time I've had to contact support about the same bug.", labels: { sentiment: "angry", urgency: 8, needsEscalation: true } },
  { state: "Your app crashed and I lost all my work, completely unacceptable.", labels: { sentiment: "angry", urgency: 10, needsEscalation: true } },
  { state: "I'm furious, nobody has responded to my emails in a week.", labels: { sentiment: "angry", urgency: 9, needsEscalation: true } },
  { state: "Can you charge me twice and not even notice? Fix this now.", labels: { sentiment: "angry", urgency: 9, needsEscalation: true } },
  { state: "This is broken again. Third time this month.", labels: { sentiment: "angry", urgency: 7, needsEscalation: true } },
  { state: "I'm quite upset, the item arrived damaged.", labels: { sentiment: "angry", urgency: 6, needsEscalation: true } },
  { state: "Not happy with the service, please look into this.", labels: { sentiment: "angry", urgency: 5, needsEscalation: false } },
  { state: "Could you tell me when my package will arrive?", labels: { sentiment: "neutral", urgency: 3, needsEscalation: false } },
  { state: "I'd like to update the shipping address on my order.", labels: { sentiment: "neutral", urgency: 3, needsEscalation: false } },
  { state: "What's the difference between the basic and pro plans?", labels: { sentiment: "neutral", urgency: 2, needsEscalation: false } },
  { state: "Is there a way to export my data as CSV?", labels: { sentiment: "neutral", urgency: 2, needsEscalation: false } },
  { state: "Just checking in on the status of ticket #4471.", labels: { sentiment: "neutral", urgency: 4, needsEscalation: false } },
  { state: "How do I reset my password?", labels: { sentiment: "neutral", urgency: 3, needsEscalation: false } },
  { state: "Do you offer discounts for annual billing?", labels: { sentiment: "neutral", urgency: 1, needsEscalation: false } },
  { state: "I need this resolved today, we have a client demo in 2 hours.", labels: { sentiment: "neutral", urgency: 9, needsEscalation: true } },
  { state: "Our production system is down, please help urgently.", labels: { sentiment: "neutral", urgency: 10, needsEscalation: true } },
  { state: "Not urgent, but the settings page has a small typo.", labels: { sentiment: "neutral", urgency: 1, needsEscalation: false } },
  { state: "Thanks, that answers my question! Really appreciate the quick reply.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "The new update is fantastic, great work team!", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "Support resolved my issue in minutes, wonderful experience.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "Loving the new dashboard, so much easier to use now.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "Just wanted to say your onboarding docs are excellent.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "All sorted now, thank you for the fast turnaround!", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "No complaints here, everything works great.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "Appreciate the refund, that was quick and painless.", labels: { sentiment: "happy", urgency: 2, needsEscalation: false } },
  { state: "This is fine for now but could be better eventually.", labels: { sentiment: "neutral", urgency: 2, needsEscalation: false } },
  { state: "I am extremely disappointed, this is the worst support I've had.", labels: { sentiment: "angry", urgency: 8, needsEscalation: true } },
  { state: "Everything is working perfectly, no issues at all.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "Can someone please escalate this, I've waited far too long.", labels: { sentiment: "angry", urgency: 9, needsEscalation: true } },
  { state: "Quick question about invoice formatting, not urgent.", labels: { sentiment: "neutral", urgency: 1, needsEscalation: false } },
  { state: "My account got locked and I can't get back in, please help ASAP.", labels: { sentiment: "angry", urgency: 8, needsEscalation: true } },
  { state: "Great feature, exactly what I needed, thank you!", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "This keeps happening and support keeps ignoring me, I want a manager.", labels: { sentiment: "angry", urgency: 10, needsEscalation: true } },
  { state: "Could you clarify how the API rate limits work?", labels: { sentiment: "neutral", urgency: 2, needsEscalation: false } },
  { state: "Data export is missing a few fields, low priority fix.", labels: { sentiment: "neutral", urgency: 2, needsEscalation: false } },
  { state: "I love how responsive the team has been, five stars.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "The site has been down for an hour, losing customers by the minute.", labels: { sentiment: "angry", urgency: 10, needsEscalation: true } },
  { state: "Just a heads up, the footer link is broken on mobile.", labels: { sentiment: "neutral", urgency: 2, needsEscalation: false } },
  { state: "Thank you so much for going above and beyond!", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "I need to change my billing email, whenever convenient.", labels: { sentiment: "neutral", urgency: 1, needsEscalation: false } },
  { state: "Absolutely unacceptable delay, I want this fixed immediately.", labels: { sentiment: "angry", urgency: 9, needsEscalation: true } },
  { state: "Everything works as expected, no complaints.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
  { state: "Could you walk me through setting up SSO?", labels: { sentiment: "neutral", urgency: 3, needsEscalation: false } },
  { state: "This is a minor cosmetic issue, fix whenever you get a chance.", labels: { sentiment: "neutral", urgency: 1, needsEscalation: false } },
  { state: "I'm impressed by how fast the new version loads.", labels: { sentiment: "happy", urgency: 1, needsEscalation: false } },
];

export const unlabeledPool: string[] = [
  "The mobile app keeps logging me out every few minutes.",
  "Really enjoying the redesign, nice job on the colors.",
  "Need help understanding my latest invoice.",
  "This is the last straw, I'm cancelling my subscription today.",
  "Small suggestion: add a dark mode toggle.",
  "Payment failed three times, please look into this soon.",
  "Just wanted to say thanks for the fast support call.",
  "Is there an ETA on the promised feature from last quarter?",
  "System keeps timing out during checkout, losing sales.",
  "Curious if there's a roadmap I can follow publicly.",
  "My data seems out of sync between devices, quite frustrating.",
  "Appreciate the detailed changelog, very transparent.",
  "Urgent: client-facing report is showing wrong totals.",
  "Not a big deal, but the tooltip text has a typo.",
  "Can't believe how smooth the migration was, great work.",
];
