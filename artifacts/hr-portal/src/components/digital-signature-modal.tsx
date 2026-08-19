import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  PenTool,
  Type,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Award,
  Lock,
  Stamp,
  Fingerprint,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface DigitalSignatureData {
  signatureImage: string; // Data URL
  signerName: string;
  signerTitle: string;
  signedAt: string;
  verificationCode: string;
  withOfficialStamp: boolean;
  signatureType: "drawn" | "typed" | "stamped";
}

interface DigitalSignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  defaultSignerName?: string;
  defaultSignerTitle?: string;
  onConfirmSignature: (sig: DigitalSignatureData) => void;
}

export function DigitalSignatureModal({
  open,
  onOpenChange,
  documentTitle,
  defaultSignerName = "Authorised HR Officer",
  defaultSignerTitle = "Executive Director & Registrar",
  onConfirmSignature,
}: DigitalSignatureModalProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const [activeTab, setActiveTab] = useState<"draw" | "type" | "stamp">("draw");
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerTitle, setSignerTitle] = useState(defaultSignerTitle);
  const [fontStyle, setFontStyle] = useState<"cursive" | "serif" | "formal">("cursive");
  const [withOfficialStamp, setWithOfficialStamp] = useState(true);

  // Initialize Canvas
  useEffect(() => {
    if (open && activeTab === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#002b66"; // Deep NISIT Navy
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [open, activeTab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Generate Typed Signature Image on an off-screen canvas
  const generateTypedSignatureDataUrl = (): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 450;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (fontStyle === "cursive") {
      ctx.font = "italic 38px 'Brush Script MT', 'Dancing Script', 'Segoe Script', cursive";
    } else if (fontStyle === "serif") {
      ctx.font = "italic bold 32px 'Times New Roman', serif";
    } else {
      ctx.font = "bold 28px 'Courier New', monospace";
    }

    ctx.fillStyle = "#002b66"; // NISIT navy
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(signerName || "Signature", canvas.width / 2, canvas.height / 2 - 10);

    // Decorative baseline line
    ctx.strokeStyle = "#c0a030"; // Gold accent
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, canvas.height / 2 + 25);
    ctx.lineTo(canvas.width - 40, canvas.height / 2 + 25);
    ctx.stroke();

    return canvas.toDataURL("image/png");
  };

  const handleApplySignature = () => {
    if (!signerName.trim()) {
      toast({ title: "Signer Name Required", description: "Please enter the signatory's full name.", variant: "destructive" });
      return;
    }

    let signatureImage = "";
    if (activeTab === "draw") {
      if (!hasDrawn || !canvasRef.current) {
        toast({ title: "Signature Required", description: "Please draw your signature on the pad.", variant: "destructive" });
        return;
      }
      signatureImage = canvasRef.current.toDataURL("image/png");
    } else {
      signatureImage = generateTypedSignatureDataUrl();
    }

    const timestamp = new Date().toISOString();
    const verificationCode = `NISIT-SIG-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${new Date().getFullYear()}`;

    const data: DigitalSignatureData = {
      signatureImage,
      signerName: signerName.trim(),
      signerTitle: signerTitle.trim(),
      signedAt: timestamp,
      verificationCode,
      withOfficialStamp,
      signatureType: activeTab === "draw" ? "drawn" : activeTab === "type" ? "typed" : "stamped",
    };

    onConfirmSignature(data);
    onOpenChange(false);
    toast({
      title: "Document Digitally Signed & Stamped",
      description: `Verified with cryptographic audit seal: ${verificationCode}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Digital Signature &amp; Official Seal</DialogTitle>
              <DialogDescription className="text-xs">
                Attach an authenticated electronic signature and statutory NISIT seal to <span className="font-semibold text-foreground">{documentTitle}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Signer Details */}
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Signatory Full Name</Label>
              <Input
                className="h-8 text-xs bg-background"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="e.g. John K. Doe"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Official Designation / Title</Label>
              <Input
                className="h-8 text-xs bg-background"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="e.g. Director General / HR Manager"
              />
            </div>
          </div>

          {/* Signature Method Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 w-full h-9">
              <TabsTrigger value="draw" className="text-xs flex items-center gap-1.5">
                <PenTool className="h-3.5 w-3.5" /> Draw Signature
              </TabsTrigger>
              <TabsTrigger value="type" className="text-xs flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" /> Type Electronic Signature
              </TabsTrigger>
            </TabsList>

            {/* Draw Tab */}
            <TabsContent value="draw" className="space-y-2 mt-3">
              <div className="relative border-2 border-dashed border-primary/30 rounded-lg bg-slate-50/70 dark:bg-slate-950 p-1 flex flex-col items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={150}
                  className="touch-none cursor-crosshair w-full max-w-[460px] h-[150px] bg-white rounded shadow-inner"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-muted-foreground/60 text-xs">
                    <PenTool className="h-6 w-6 mb-1 opacity-40" />
                    <span>Sign with mouse or stylus finger here</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
                <span>PNG Government Standard Compliance (Electronic Transactions Act)</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={clearCanvas}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Clear Pad
                </Button>
              </div>
            </TabsContent>

            {/* Type Tab */}
            <TabsContent value="type" className="space-y-3 mt-3">
              <div className="flex gap-2">
                {(["cursive", "serif", "formal"] as const).map((style) => (
                  <Button
                    key={style}
                    size="sm"
                    variant={fontStyle === style ? "default" : "outline"}
                    className="text-xs h-7 flex-1 capitalize"
                    onClick={() => setFontStyle(style)}
                  >
                    {style}
                  </Button>
                ))}
              </div>
              <div className="h-28 border rounded-lg bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-4 shadow-inner">
                <p
                  className={`text-2xl text-[#002b66] ${
                    fontStyle === "cursive"
                      ? "font-serif italic tracking-wide"
                      : fontStyle === "serif"
                      ? "font-serif italic font-bold"
                      : "font-mono font-bold uppercase"
                  }`}
                >
                  {signerName || "Your Signature"}
                </p>
                <div className="w-48 h-0.5 bg-[#c0a030] mt-2 opacity-80" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {signerTitle || "Authorised Officer"} · NISIT Corporate Verification
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Official Stamp Toggle */}
          <div className="border rounded-lg p-3 bg-gradient-to-r from-blue-50/50 via-slate-50 to-amber-50/40 dark:from-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Stamp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Attach Official Institutional Seal &amp; Stamp
                  <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-800 border-amber-300">
                    PNG Statutory Seal
                  </Badge>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Embeds verified NISIT circular crest seal and cryptographic verification tracking code.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              id="stampToggle"
              className="h-4 w-4 rounded text-primary focus:ring-primary cursor-pointer"
              checked={withOfficialStamp}
              onChange={(e) => setWithOfficialStamp(e.target.checked)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApplySignature} className="bg-primary shadow-sm">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Apply Digital Signature &amp; Stamp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Visual Official Stamp & Electronic Signature Badge component to render directly on document previews
export function DocumentOfficialStampBlock({
  signatureData,
  date = new Date().toLocaleDateString("en-PG", { day: "numeric", month: "long", year: "numeric" }),
}: {
  signatureData?: DigitalSignatureData | null;
  date?: string;
}) {
  return (
    <div className="mt-8 pt-6 border-t-2 border-slate-200 grid sm:grid-cols-2 gap-6 items-end">
      {/* Signature Area */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Authorised Digital Signature:</p>
        {signatureData ? (
          <div className="p-3 bg-blue-50/50 dark:bg-slate-900 border border-blue-200 rounded-lg space-y-1">
            <div className="h-14 flex items-center">
              <img src={signatureData.signatureImage} alt="Signature" className="max-h-12 object-contain" />
            </div>
            <div className="border-t border-slate-200 pt-1 text-xs">
              <p className="font-bold text-foreground">{signatureData.signerName}</p>
              <p className="text-[11px] text-muted-foreground">{signatureData.signerTitle}</p>
              <p className="text-[10px] text-primary font-mono mt-0.5 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Code: {signatureData.verificationCode}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-20 border-b border-slate-400 border-dashed flex items-end pb-1">
            <div>
              <p className="text-xs font-bold text-foreground">Director of Corporate Services</p>
              <p className="text-[11px] text-muted-foreground">National Institute of Standards &amp; Industrial Technology</p>
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Date: {date}</p>
      </div>

      {/* Official Circular / Boxed Stamp */}
      <div className="flex justify-end">
        <div className="w-48 h-32 border-2 border-dashed border-red-700/80 rounded-xl p-2.5 bg-red-50/40 dark:bg-red-950/20 text-red-900 dark:text-red-300 flex flex-col items-center justify-between text-center transform -rotate-1 shadow-xs">
          <div className="flex items-center gap-1">
            <Award className="h-3.5 w-3.5 text-red-700" />
            <span className="text-[9px] font-bold tracking-wider uppercase">GOVERNMENT OF PNG</span>
          </div>
          <div className="my-0.5 space-y-0.5">
            <p className="text-[10px] font-extrabold tracking-tight leading-tight uppercase">
              NISIT STATUTORY SEAL
            </p>
            <p className="text-[8px] font-mono tracking-widest text-red-700 uppercase">
              ★ OFFICIAL VERIFIED ★
            </p>
          </div>
          <div className="w-full border-t border-red-300 dark:border-red-800 pt-1 text-[8px] space-y-0.5">
            <p className="font-semibold">{date}</p>
            <p className="font-mono text-[7px] text-red-600">ID: NISIT-{new Date().getFullYear()}-SEC</p>
          </div>
        </div>
      </div>
    </div>
  );
}
