import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UploadCloud, 
  Camera, 
  AlertTriangle, 
  Activity, 
  ShieldAlert, 
  Stethoscope, 
  Info, 
  Loader2, 
  CheckCircle2, 
  X,
  RefreshCw
} from 'lucide-react';

// Define the expected JSON structure
interface AnalysisResult {
  disease_name: string;
  confidence: string;
  severity: string;
  symptoms_detected: string[];
  possible_causes: string[];
  precautions: string[];
  consult_doctor: string;
  disclaimer: string;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImage(base64);
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImageUpload(e.target.files[0]);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
      setError(null);
    } catch (err) {
      setError('Unable to access camera. Please ensure permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg');
        setImage(base64);
        setResult(null);
        stopCamera();
      }
    }
  };

  const analyzeSkin = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Extract base64 data and mime type
      const [header, data] = image.split(',');
      const mimeType = header.split(':')[1].split(';')[0];

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is missing. Please configure it in your environment.');
      }
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: data,
                mimeType: mimeType,
              },
            },
            {
              text: 'Analyze this skin image and provide a structured medical report.',
            },
          ],
        },
        config: {
          systemInstruction: `You are an advanced medical AI assistant specialized in dermatology image analysis.
This is for educational and hackathon prototype purposes only.
Do not claim to be a licensed doctor.
Always include a medical disclaimer.
If uncertain, say confidence is low.

Instructions for Image Analysis:
1. Identify possible skin condition name.
2. Give probability percentage (confidence level).
3. Describe visible symptoms detected in image.
4. Mention possible causes.
5. Suggest basic precautions.
6. Suggest whether the patient should consult a dermatologist.
7. Provide severity level: Mild / Moderate / Severe.
8. If image quality is poor, say so clearly.
9. Output response strictly in JSON format.

Be medically responsible, cautious, and conservative in predictions.
Do not exaggerate accuracy.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              disease_name: { type: Type.STRING, description: "Name of the possible skin condition" },
              confidence: { type: Type.STRING, description: "Probability percentage (e.g., '75%')" },
              severity: { type: Type.STRING, description: "Mild, Moderate, or Severe" },
              symptoms_detected: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of visible symptoms" },
              possible_causes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of possible causes" },
              precautions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of basic precautions" },
              consult_doctor: { type: Type.STRING, description: "Recommendation on whether to consult a dermatologist" },
              disclaimer: { type: Type.STRING, description: "Medical disclaimer text" },
            },
            required: [
              'disease_name',
              'confidence',
              'severity',
              'symptoms_detected',
              'possible_causes',
              'precautions',
              'consult_doctor',
              'disclaimer',
            ],
          },
        },
      });

      if (response.text) {
        const parsedResult = JSON.parse(response.text) as AnalysisResult;
        setResult(parsedResult);
      } else {
        throw new Error('No response received from the model.');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'An error occurred during analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Activity size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">SkinGuardians</h1>
          </div>
          <div className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Educational Prototype
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Disclaimer Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-amber-800">
            <strong className="font-semibold block mb-1">Medical Disclaimer</strong>
            This application is a hackathon prototype intended for educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Camera size={18} className="text-blue-600" />
                  Image Input
                </h2>
                <p className="text-sm text-slate-500 mt-1">Upload or capture a clear photo of the skin condition.</p>
              </div>

              <div className="p-5">
                {!image && !isCameraOpen && (
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                      ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className="mx-auto text-slate-400 mb-4" size={32} />
                    <p className="text-sm font-medium text-slate-700 mb-1">Click or drag image here</p>
                    <p className="text-xs text-slate-500">Supports JPG, PNG (Max 5MB)</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={onFileChange}
                    />
                  </div>
                )}

                {!image && !isCameraOpen && (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex-1 h-px bg-slate-200"></div>
                    <span className="text-xs text-slate-400 font-medium uppercase">OR</span>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>
                )}

                {!image && !isCameraOpen && (
                  <button
                    onClick={startCamera}
                    className="mt-4 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Camera size={16} />
                    Use Camera
                  </button>
                )}

                {isCameraOpen && (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
                      <button
                        onClick={stopCamera}
                        className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-colors"
                      >
                        <X size={24} />
                      </button>
                      <button
                        onClick={captureImage}
                        className="w-14 h-14 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
                      >
                        <div className="w-10 h-10 bg-white rounded-full"></div>
                      </button>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}

                {image && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={image} alt="Uploaded skin condition" className="w-full h-auto object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={reset}
                        className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-100 transition-colors"
                      >
                        <RefreshCw size={16} />
                        Change Image
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {image && !result && (
                  <button
                    onClick={analyzeSkin}
                    disabled={isAnalyzing}
                    className="mt-6 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Analyzing Image...
                      </>
                    ) : (
                      <>
                        <Activity size={18} />
                        Analyze Skin Condition
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {!result && !isAnalyzing ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full min-h-[400px] bg-slate-100/50 border border-slate-200 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-400 p-8 text-center"
                >
                  <Activity size={48} className="mb-4 opacity-20" />
                  <p className="text-lg font-medium text-slate-500 mb-2">Awaiting Image</p>
                  <p className="text-sm max-w-sm">Upload an image of a skin condition to receive an AI-generated educational analysis.</p>
                </motion.div>
              ) : isAnalyzing ? (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full min-h-[400px] bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 text-center shadow-sm"
                >
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                      <Activity size={24} />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Analyzing Image</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    The AI is examining the visual characteristics, identifying symptoms, and generating a structured report...
                  </p>
                </motion.div>
              ) : result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                >
                  {/* Result Header */}
                  <div className="bg-slate-900 p-6 text-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Detected Condition</p>
                        <h2 className="text-2xl font-semibold">{result.disease_name}</h2>
                      </div>
                      <div className="flex gap-3">
                        <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-center">
                          <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Confidence</p>
                          <p className="text-sm font-medium text-blue-400">{result.confidence}</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-center">
                          <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Severity</p>
                          <p className={`text-sm font-medium ${
                            result.severity.toLowerCase().includes('severe') ? 'text-red-400' :
                            result.severity.toLowerCase().includes('moderate') ? 'text-amber-400' :
                            'text-emerald-400'
                          }`}>
                            {result.severity}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Result Body */}
                  <div className="p-6 space-y-8">
                    {/* Symptoms & Causes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                          <Activity size={16} className="text-blue-600" />
                          Symptoms Detected
                        </h3>
                        <ul className="space-y-2">
                          {result.symptoms_detected.map((symptom, idx) => (
                            <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                              {symptom}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                          <Info size={16} className="text-blue-600" />
                          Possible Causes
                        </h3>
                        <ul className="space-y-2">
                          {result.possible_causes.map((cause, idx) => (
                            <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></span>
                              {cause}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Precautions */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                        <ShieldAlert size={16} className="text-emerald-600" />
                        Suggested Precautions
                      </h3>
                      <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                        <ul className="space-y-2">
                          {result.precautions.map((precaution, idx) => (
                            <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                              {precaution}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Doctor Recommendation */}
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-start gap-3">
                      <Stethoscope className="text-blue-600 shrink-0 mt-0.5" size={20} />
                      <div>
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Recommendation</h4>
                        <p className="text-sm text-blue-800 leading-relaxed">{result.consult_doctor}</p>
                      </div>
                    </div>

                    {/* Disclaimer Footer */}
                    <div className="text-xs text-slate-400 text-center pt-4 border-t border-slate-100">
                      {result.disclaimer}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
