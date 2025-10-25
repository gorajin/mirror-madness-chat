import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ControlPanelProps {
  intensity: number;
  tone: "compliment" | "roast" | "coach";
  onIntensityChange: (value: number) => void;
  onToneChange: (tone: "compliment" | "roast" | "coach") => void;
}

export const ControlPanel = ({
  intensity,
  tone,
  onIntensityChange,
  onToneChange,
}: ControlPanelProps) => {
  const tones: Array<{ value: "compliment" | "roast" | "coach"; label: string; emoji: string }> = [
    { value: "compliment", label: "Compliment", emoji: "💖" },
    { value: "roast", label: "Roast", emoji: "🔥" },
    { value: "coach", label: "Chaotic Coach", emoji: "🎯" },
  ];

  return (
    <div className="space-y-6 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border">
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <span>Gaslight Intensity</span>
          <span className="text-2xl">{["😇", "😏", "😈", "👹"][intensity]}</span>
        </Label>
        <Slider
          value={[intensity]}
          onValueChange={(values) => onIntensityChange(values[0])}
          max={3}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Normal</span>
          <span>Subtle</span>
          <span>Wild</span>
          <span>Unhinged</span>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Tone</Label>
        <div className="grid grid-cols-3 gap-2">
          {tones.map((t) => (
            <Button
              key={t.value}
              onClick={() => onToneChange(t.value)}
              variant={tone === t.value ? "default" : "outline"}
              className={`flex flex-col items-center gap-1 h-auto py-3 ${
                tone === t.value
                  ? "bg-gradient-to-br from-primary to-secondary border-primary"
                  : "hover:bg-muted"
              }`}
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-xs">{t.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
