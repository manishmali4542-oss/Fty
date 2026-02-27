export interface MCQ {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: "A" | "B" | "C" | "D";
  explanation_correct: string;
  explanation_incorrect: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
}

export interface MCQResponse {
  mcqs: MCQ[];
}
