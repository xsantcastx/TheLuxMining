export interface SetupGuideStep {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  order: number;
}

export interface SetupGuide {
  id: string;
  title: string;
  subtitle: string;
  heroImageUrl?: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  introduction: string;
  steps: SetupGuideStep[];
  requirementsTitle?: string;
  requirements?: string[];
  supportContactEmail?: string;
  supportContactPhone?: string;
  faqTitle?: string;
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
