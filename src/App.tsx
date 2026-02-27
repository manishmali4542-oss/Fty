/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw,
  BookOpen,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { MCQ, MCQResponse } from './types';
import { generateMCQs, extractTextFromImage } from './services/geminiService';
import { extractTextFromPDF, getPDFPageAsImage } from './utils/pdfExtractor';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showFeedback, setShowFeedback] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setError(null);
      
      if (selectedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }

    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError("This file type is not supported. Please upload a PDF or an image (JPG, PNG, WEBP, HEIC).");
      } else {
        setError(rejection.errors[0]?.message || "File was rejected.");
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.jfif'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif']
    },
    multiple: false
  } as any);

  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    setMcqs([]);
    setCurrentIndex(0);
    setAnswers({});
    setShowFeedback({});
    setError(null);

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        setLoadingStage('Extracting text from PDF...');
        text = await extractTextFromPDF(file);
        
        // Fallback for scanned PDFs
        if (text.trim().length < 50) {
          setLoadingStage('Scanned PDF detected. Using AI OCR...');
          const pageImage = await getPDFPageAsImage(file, 1);
          text = await extractTextFromImage(pageImage, 'image/png');
          
          // If still no text, try page 2 if it exists
          if (text.trim().length < 50) {
             try {
               const pageImage2 = await getPDFPageAsImage(file, 2);
               const text2 = await extractTextFromImage(pageImage2, 'image/png');
               text += "\n" + text2;
             } catch (e) {
               // Page 2 might not exist
             }
          }
        }
      } else {
        setLoadingStage('Analyzing image with AI...');
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        text = await extractTextFromImage(base64, file.type);
      }

      if (!text.trim()) {
        throw new Error("No text could be extracted from the file. Please try a clearer document.");
      }

      setLoadingStage('Generating high-quality MCQs...');
      const response = await generateMCQs(text);
      
      if (response.mcqs && response.mcqs.length > 0) {
        setMcqs(response.mcqs);
      } else {
        throw new Error("The AI was unable to generate questions from this content. Try a longer or more detailed document.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleAnswerSelect = (option: string) => {
    if (showFeedback[currentIndex]) return;

    setAnswers(prev => ({ ...prev, [currentIndex]: option }));
    setShowFeedback(prev => ({ ...prev, [currentIndex]: true }));
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setMcqs([]);
    setAnswers({});
    setShowFeedback({});
    setError(null);
  };

  const currentMcq = mcqs[currentIndex];
  const isCorrect = currentMcq && answers[currentIndex] === currentMcq.correct_answer;

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1C1917] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <BrainCircuit size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900">ExamCraft</h1>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-stone-400 -mt-1">AI MCQ Generator</p>
            </div>
          </div>
          
          {mcqs.length > 0 && (
            <button 
              onClick={reset}
              className="flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
            >
              <RotateCcw size={16} />
              <span>Start Over</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {mcqs.length === 0 ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <h2 className="text-4xl font-light text-stone-900 tracking-tight">
                  Turn your notes into <span className="font-semibold text-emerald-600">practice exams.</span>
                </h2>
                <p className="text-stone-500 max-w-xl mx-auto">
                  Upload a PDF or an image of your study material. Our AI will analyze the content and generate 10 high-quality MCQs to test your understanding.
                </p>
              </div>

              <div 
                {...getRootProps()} 
                className={cn(
                  "border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer group relative overflow-hidden",
                  isDragActive ? "border-emerald-500 bg-emerald-50/50" : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50"
                )}
              >
                <input {...getInputProps()} />
                
                {previewUrl ? (
                  <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-md border border-stone-200">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <RotateCcw className="text-white" size={24} />
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
                    isDragActive ? "bg-emerald-100 text-emerald-600" : "bg-stone-100 text-stone-400"
                  )}>
                    {file?.type === 'application/pdf' ? <FileText size={32} /> : <Upload size={32} />}
                  </div>
                )}

                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-stone-900">
                    {file ? file.name : "Drop your file or image here"}
                  </p>
                  {!file && (
                    <button className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-semibold hover:bg-stone-200 transition-colors">
                      Select from Gallery
                    </button>
                  )}
                  <p className="text-sm text-stone-400 mt-1">
                    Supports PDF, JPG, PNG, WebP, HEIC
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600">
                  <XCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex justify-center">
                <button
                  disabled={!file || loading}
                  onClick={handleProcess}
                  className={cn(
                    "px-8 py-4 rounded-2xl font-semibold text-white transition-all duration-300 flex items-center gap-3 shadow-xl",
                    !file || loading 
                      ? "bg-stone-300 cursor-not-allowed" 
                      : "bg-stone-900 hover:bg-stone-800 active:scale-95 shadow-stone-200"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>{loadingStage || 'Processing...'}</span>
                    </>
                  ) : (
                    <>
                      <BookOpen size={20} />
                      <span>Generate MCQs</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Question {currentIndex + 1} of {mcqs.length}</span>
                  <span className="text-sm font-semibold text-stone-900">{Math.round(((currentIndex + 1) / mcqs.length) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex + 1) / mcqs.length) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-stone-100">
                <h3 className="text-2xl font-medium text-stone-900 leading-tight mb-10">
                  {currentMcq.question}
                </h3>

                <div className="grid gap-4">
                  {(Object.entries(currentMcq.options) as [string, string][]).map(([key, value]) => {
                    const isSelected = answers[currentIndex] === key;
                    const isCorrectOption = key === currentMcq.correct_answer;
                    const showResult = showFeedback[currentIndex];

                    return (
                      <button
                        key={key}
                        disabled={showResult}
                        onClick={() => handleAnswerSelect(key)}
                        className={cn(
                          "group relative flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200",
                          !showResult && "hover:border-stone-300 hover:bg-stone-50 active:scale-[0.99]",
                          !showResult && isSelected ? "border-stone-900 bg-stone-50" : "border-stone-100",
                          showResult && isCorrectOption && "border-emerald-500 bg-emerald-50/50",
                          showResult && isSelected && !isCorrectOption && "border-red-500 bg-red-50/50",
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors",
                          !showResult && isSelected ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500",
                          showResult && isCorrectOption && "bg-emerald-500 text-white",
                          showResult && isSelected && !isCorrectOption && "bg-red-500 text-white",
                        )}>
                          {key}
                        </div>
                        <span className={cn(
                          "font-medium transition-colors",
                          showResult && isCorrectOption ? "text-emerald-900" : "text-stone-700",
                          showResult && isSelected && !isCorrectOption && "text-red-900"
                        )}>
                          {value}
                        </span>

                        {showResult && isCorrectOption && (
                          <CheckCircle2 className="ml-auto text-emerald-500" size={24} />
                        )}
                        {showResult && isSelected && !isCorrectOption && (
                          <XCircle className="ml-auto text-red-500" size={24} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Section */}
                <AnimatePresence>
                  {showFeedback[currentIndex] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-10 pt-10 border-t border-stone-100 space-y-6"
                    >
                      <div className={cn(
                        "p-6 rounded-2xl space-y-3",
                        isCorrect ? "bg-emerald-50/50 border border-emerald-100" : "bg-red-50/50 border border-red-100"
                      )}>
                        <div className="flex items-center gap-2">
                          {isCorrect ? (
                            <CheckCircle2 className="text-emerald-600" size={20} />
                          ) : (
                            <XCircle className="text-red-600" size={20} />
                          )}
                          <span className={cn(
                            "font-bold uppercase tracking-wider text-xs",
                            isCorrect ? "text-emerald-700" : "text-red-700"
                          )}>
                            {isCorrect ? "Correct Answer" : "Incorrect Selection"}
                          </span>
                        </div>
                        <p className="text-stone-800 leading-relaxed">
                          {currentMcq.explanation_correct}
                        </p>
                      </div>

                      {!isCorrect && (
                        <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-2">
                          <span className="font-bold uppercase tracking-wider text-xs text-stone-400">Why your choice was wrong:</span>
                          <p className="text-stone-600 leading-relaxed">
                            {currentMcq.explanation_incorrect[answers[currentIndex] as keyof typeof currentMcq.explanation_incorrect]}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end pt-4">
                        {currentIndex < mcqs.length - 1 ? (
                          <button
                            onClick={() => setCurrentIndex(prev => prev + 1)}
                            className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 transition-all active:scale-95"
                          >
                            <span>Next Question</span>
                            <ChevronRight size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={reset}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all active:scale-95"
                          >
                            <RotateCcw size={18} />
                            <span>Start New Quiz</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation Footer */}
              <div className="flex items-center justify-between px-4">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                  className={cn(
                    "flex items-center gap-2 text-sm font-semibold transition-colors",
                    currentIndex === 0 ? "text-stone-300 cursor-not-allowed" : "text-stone-500 hover:text-stone-900"
                  )}
                >
                  <ChevronLeft size={18} />
                  <span>Previous</span>
                </button>
                
                <div className="flex gap-1.5">
                  {mcqs.map((_, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-300",
                        idx === currentIndex ? "w-6 bg-stone-900" : "bg-stone-300"
                      )}
                    />
                  ))}
                </div>

                <div className="w-20" /> {/* Spacer for balance */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-stone-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-stone-400">
            <BrainCircuit size={18} />
            <span className="text-sm font-medium">Powered by Gemini AI</span>
          </div>
          <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-stone-400">
            <span className="hover:text-stone-600 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-stone-600 cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-stone-600 cursor-pointer transition-colors">Help</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
