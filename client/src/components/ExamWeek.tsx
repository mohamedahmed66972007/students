import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useExams } from "@/hooks/useExams";
import { Button } from "@/components/ui/button";
import { format, parseISO, differenceInDays } from "date-fns";
import { arEG } from "date-fns/locale";

interface ExamListProps {
  exams: Exam[];
}

export default function ExamList({ exams }: ExamListProps) {
  const { isAdmin } = useAuth();
  const { deleteExam } = useExams();

  const handleDeleteExam = async (examId: number) => {
    await deleteExam(examId);
  };

  const getArabicSubject = (subject: string) => {
    const subjects: Record<string, string> = {
      'math': 'الرياضيات',
      'physics': 'الفيزياء',
      'chemistry': 'الكيمياء',
      'biology': 'الأحياء',
      'arabic': 'اللغة العربية',
      'english': 'اللغة الإنجليزية',
      'computer': 'الحاسب الآلي',
    };
    return subjects[subject.toLowerCase()] || subject;
  };

  const sortedExams = [...exams].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const calculateRemainingDays = (examDate: string) => {
    const today = new Date();
    const targetDate = parseISO(examDate);
    const days = differenceInDays(targetDate, today);
    return days;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs font-semibold tracking-wide text-right text-gray-500 uppercase border-b dark:border-gray-700 bg-gray-50 dark:text-gray-400 dark:bg-gray-800">
              <th className="px-4 py-3">المادة</th>
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">الأيام المتبقية</th>
              <th className="px-4 py-3">الدروس المقررة</th>
              {isAdmin && <th className="px-4 py-3">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y dark:divide-gray-700 dark:bg-gray-800">
            {sortedExams.map((exam) => {
              const date = exam.date ? new Date(exam.date) : null;
              const remainingDays = date ? calculateRemainingDays(exam.date) : null;
              return (
                <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{getArabicSubject(exam.subject)}</td>
                  <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                    {date && !isNaN(date.getTime()) ? format(date, 'dd/MM/yyyy', { locale: arEG }) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                    {remainingDays && remainingDays > 0 ? `${remainingDays} يوم` : 'اليوم'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                    <ul className="list-disc list-inside">
                      {exam.topics.map((topic, index) => (
                        <li key={index}>{topic}</li>
                      ))}
                    </ul>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteExam(exam.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        حذف
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}