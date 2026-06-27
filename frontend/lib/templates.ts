/**
 * Built-in template definitions for the Template Library.
 * Each template contains a set of tasks that can be batch-created.
 */

export interface TemplateTask {
  title: string;
  notes: string;
  due_days_from_now: number;
  priority: "high" | "medium" | "low" | "none";
}

export interface Template {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  tasks: TemplateTask[];
}

export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: "product-launch",
    title: "Product Launch",
    description:
      "End-to-end product launch checklist covering research, development, testing, marketing, and launch day activities.",
    icon: "Rocket",
    category: "Work",
    tasks: [
      {
        title: "Market research and competitor analysis",
        notes: "Identify key competitors, market gaps, and target audience. Document findings in a shared doc.",
        due_days_from_now: 2,
        priority: "high",
      },
      {
        title: "Define MVP feature set",
        notes: "Based on research, list the core features needed for launch. Keep scope tight.",
        due_days_from_now: 4,
        priority: "high",
      },
      {
        title: "Build and iterate on MVP",
        notes: "Develop the minimum viable product. Focus on quality over quantity of features.",
        due_days_from_now: 10,
        priority: "high",
      },
      {
        title: "Internal testing and QA",
        notes: "Run thorough testing. Document bugs and prioritize fixes before launch.",
        due_days_from_now: 12,
        priority: "medium",
      },
      {
        title: "Prepare marketing materials",
        notes: "Create landing page copy, social media posts, email sequences, and press kit.",
        due_days_from_now: 13,
        priority: "medium",
      },
      {
        title: "Set up analytics and tracking",
        notes: "Configure event tracking, conversion funnels, and dashboards to monitor launch metrics.",
        due_days_from_now: 13,
        priority: "low",
      },
      {
        title: "Beta testing with early adopters",
        notes: "Share with a small group of users. Collect feedback and iterate quickly.",
        due_days_from_now: 14,
        priority: "medium",
      },
      {
        title: "Launch day execution",
        notes: "Publish product, send announcements, monitor systems, and engage with early users.",
        due_days_from_now: 16,
        priority: "high",
      },
    ],
  },
  {
    id: "interview-prep",
    title: "Interview Prep",
    description:
      "Comprehensive preparation plan for an upcoming job interview, from research to outfit planning.",
    icon: "Briefcase",
    category: "Career",
    tasks: [
      {
        title: "Research the company thoroughly",
        notes: "Study their mission, products, recent news, culture, and key people you might meet.",
        due_days_from_now: 1,
        priority: "high",
      },
      {
        title: "Practice common interview questions",
        notes: "Prepare answers for behavioral, technical, and situational questions. Practice out loud.",
        due_days_from_now: 2,
        priority: "high",
      },
      {
        title: "Prepare STAR method stories",
        notes: "Write 4-5 stories using Situation, Task, Action, Result framework for behavioral questions.",
        due_days_from_now: 3,
        priority: "medium",
      },
      {
        title: "Plan your outfit",
        notes: "Choose professional attire appropriate for the company culture. Iron and prep the night before.",
        due_days_from_now: 4,
        priority: "low",
      },
      {
        title: "Prepare questions to ask the interviewer",
        notes: "Have 3-5 thoughtful questions about the role, team, growth, and company direction.",
        due_days_from_now: 4,
        priority: "medium",
      },
      {
        title: "Review and update your resume",
        notes: "Ensure resume is current, tailored to the role, and you can speak to every bullet point.",
        due_days_from_now: 1,
        priority: "high",
      },
    ],
  },
  {
    id: "weekly-review",
    title: "Weekly Review",
    description:
      "A structured end-of-week review to reflect on accomplishments, plan ahead, and stay aligned with goals.",
    icon: "ClipboardCheck",
    category: "Productivity",
    tasks: [
      {
        title: "Review completed tasks from this week",
        notes: "Look through what you accomplished. Celebrate wins and note what took longer than expected.",
        due_days_from_now: 0,
        priority: "medium",
      },
      {
        title: "Plan priorities for next week",
        notes: "Identify the top 3-5 most important tasks for next week. Block time for them on your calendar.",
        due_days_from_now: 0,
        priority: "high",
      },
      {
        title: "Clean and organize inbox",
        notes: "Process all emails to zero. Archive, respond, or create tasks from anything remaining.",
        due_days_from_now: 0,
        priority: "medium",
      },
      {
        title: "Update goals and progress tracking",
        notes: "Check progress on monthly/quarterly goals. Adjust timelines if needed.",
        due_days_from_now: 0,
        priority: "low",
      },
      {
        title: "Reflect on the week",
        notes: "What went well? What could improve? Any lessons learned? Write a brief journal entry.",
        due_days_from_now: 0,
        priority: "low",
      },
    ],
  },
  {
    id: "move-to-new-city",
    title: "Move to New City",
    description:
      "Complete relocation checklist from research to settling in, covering housing, logistics, and exploration.",
    icon: "MapPin",
    category: "Life",
    tasks: [
      {
        title: "Research neighborhoods and areas",
        notes: "Look into safety, commute times, amenities, cost of living, and community vibe for different areas.",
        due_days_from_now: 3,
        priority: "high",
      },
      {
        title: "Find and secure housing",
        notes: "Browse listings, schedule virtual tours, apply for apartments. Budget for first/last month and deposit.",
        due_days_from_now: 14,
        priority: "high",
      },
      {
        title: "Transfer or set up utilities",
        notes: "Arrange electricity, water, internet, and gas for new address. Cancel services at old address.",
        due_days_from_now: 21,
        priority: "medium",
      },
      {
        title: "Update address everywhere",
        notes: "DMV, bank, insurance, subscriptions, employer, USPS mail forwarding, voter registration.",
        due_days_from_now: 25,
        priority: "medium",
      },
      {
        title: "Pack belongings systematically",
        notes: "Start with rarely used items. Label all boxes by room. Create inventory list for valuables.",
        due_days_from_now: 26,
        priority: "medium",
      },
      {
        title: "Arrange transportation and movers",
        notes: "Get quotes from moving companies or rent a truck. Book well in advance for better rates.",
        due_days_from_now: 20,
        priority: "high",
      },
      {
        title: "Set up new living space",
        notes: "Unpack essentials first (bed, kitchen, bathroom). Deep clean before fully unpacking.",
        due_days_from_now: 30,
        priority: "medium",
      },
      {
        title: "Explore the new neighborhood",
        notes: "Find your new grocery store, gym, coffee shop, park. Introduce yourself to neighbors.",
        due_days_from_now: 35,
        priority: "low",
      },
    ],
  },
];
