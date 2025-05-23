import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExams } from "@/hooks/useExams";
import { useToast } from "@/hooks/use-toast";
import { subjects } from "@shared/schema";

interface AddExamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddExamModal({ isOpen, onClose }: AddExamModalProps) {
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [topics, setTopics] = useState("");

  const { addExam } = useExams();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject || !date || !topics) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }

    const topicsArray = topics.split("\n").filter(topic => topic.trim());

    if (topicsArray.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال الدروس المقررة",
        variant: "destructive",
      });
      return;
    }

    try {
      await addExam({
        subject,
        date,
        topics: topicsArray,
      });

      toast({
        title: "تم إضافة الاختبار بنجاح",
      });

      setSubject("");
      setDate("");
      setTopics("");
      onClose();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة الاختبار",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة اختبار جديد</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المادة" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="الدروس المقررة (كل درس في سطر)"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              rows={5}
            />
          </div>

          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit">
              إضافة
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}