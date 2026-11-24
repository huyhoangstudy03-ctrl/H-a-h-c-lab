import React, { useMemo, useState } from 'react';
import { BookOpen, FlaskConical, Search } from 'lucide-react';
import { CURRICULUM_KNTT, type CurriculumTopic } from '../data/curriculumKNTT';

interface CurriculumKNTTPageProps {
  onOpenReactionInLab: (reactionId: string) => void;
}

export const CurriculumKNTTPage: React.FC<CurriculumKNTTPageProps> = ({
  onOpenReactionInLab,
}) => {
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 10 | 11 | 12>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(CURRICULUM_KNTT[0].id);

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CURRICULUM_KNTT.filter((t) => {
      if (gradeFilter !== 'ALL' && t.grade !== gradeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.keyPoints.some((kp) => kp.toLowerCase().includes(q)) ||
        t.keyEquations.some((eq) => eq.toLowerCase().includes(q))
      );
    });
  }, [gradeFilter, searchQuery]);

  const activeTopic: CurriculumTopic | undefined =
    filteredTopics.find((t) => t.id === selectedTopicId) ?? filteredTopics[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-sky-400">
            Chương trình GDPT 2018 — Bộ sách Kết nối tri thức với cuộc sống
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
            Tổng hợp Kiến thức Hóa học Lớp 10, 11, 12
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
            {(['ALL', 10, 11, 12] as const).map((g) => (
              <button
                key={String(g)}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  gradeFilter === g
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {g === 'ALL' ? 'Tất cả (10-12)' : `Lớp ${g}`}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm chuyên đề, công thức..."
              className="rounded-xl border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {filteredTopics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0F172A] p-10 text-center text-sm text-slate-400">
          Không tìm thấy chuyên đề phù hợp với từ khóa &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Chapter List */}
          <div className="lg:col-span-5 space-y-2.5">
            {filteredTopics.map((topic) => {
              const isSelected = activeTopic?.id === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-sky-400 bg-sky-500/15'
                      : 'border-slate-800 bg-[#0F172A] hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-sky-400">{topic.chapterNumber}</span>
                    <span>Lớp {topic.grade} KNTT</span>
                  </div>
                  <h2 className="mt-1 text-base font-bold text-slate-50">{topic.title}</h2>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">{topic.summary}</p>
                </button>
              );
            })}
          </div>

          {/* Selected Chapter Detail */}
          {activeTopic && (
            <article className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0F172A] p-6 space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <BookOpen className="h-4 w-4 text-sky-400" />
                  <span className="text-sky-300 font-semibold">{activeTopic.chapterNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span>Sách Kết nối tri thức với cuộc sống</span>
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-50">{activeTopic.title}</h2>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{activeTopic.summary}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-3">
                  Kiến thức trọng tâm cần ghi nhớ
                </h3>
                <ul className="space-y-2.5">
                  {activeTopic.keyPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-sm text-slate-300 leading-relaxed"
                    >
                      <span className="mt-0.5 font-mono text-xs font-bold text-sky-400">
                        0{idx + 1}.
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-3">
                  Phương trình &amp; Hệ thức tiêu biểu
                </h3>
                <div className="space-y-2">
                  {activeTopic.keyEquations.map((eq, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 font-mono text-sm font-semibold text-amber-300"
                    >
                      {eq}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 p-4">
                <p className="text-xs font-semibold text-amber-300">Lưu ý giải bài tập &amp; ôn thi</p>
                <p className="mt-1 text-sm text-amber-100/90 leading-relaxed">
                  {activeTopic.examTips}
                </p>
              </div>

              {activeTopic.relatedReactionId && (
                <button
                  type="button"
                  onClick={() => onOpenReactionInLab(activeTopic.relatedReactionId!)}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors"
                >
                  <FlaskConical className="h-4 w-4" />
                  Thực hành phản ứng minh họa trong Phòng Lab 3D
                </button>
              )}
            </article>
          )}
        </div>
      )}
    </div>
  );
};
