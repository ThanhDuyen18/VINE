import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";

const AttendanceSettings = () => {
  const [onTime, setOnTime] = useState<string>("09:00");
  const { toast } = useToast();

  useEffect(() => {
    const savedSettings = localStorage.getItem('attendanceSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setOnTime(settings.onTime || "09:00");
    }
  }, []);

  const handleSave = () => {
    const settings = {
      onTime
    };
    localStorage.setItem('attendanceSettings', JSON.stringify(settings));
    toast({
      title: "Success",
      description: "Attendance settings saved successfully"
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Attendance Time Settings
        </CardTitle>
        <CardDescription>
          Configure the on-time check-in cutoff time for employees
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="onTime">On-Time Check-in Cutoff</Label>
            <Input
              id="onTime"
              type="time"
              value={onTime}
              onChange={(e) => setOnTime(e.target.value)}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Employees checking in after this time will be marked as late. 
              <br />
              Any check-in after this cutoff time will increase their late rate.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Example:</strong> If you set on-time to 09:00, employees checking in at 09:01 or later will be marked as late.
            </p>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90">
              Save Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceSettings;
