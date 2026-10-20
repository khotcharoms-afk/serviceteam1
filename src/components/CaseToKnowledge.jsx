// src/components/CaseToKnowledge.jsx — หลังปิดเคส (สถานะ "เสร็จสิ้น") ชวนบันทึกวิธีแก้ลง Knowledge Hub
// เติมหัวข้อ/อาการ/วิธีแก้จากเคสให้ แก้ได้ก่อนบันทึก · บันทึกแล้วผูก knowledgeId ไว้กับเคส
import { useState } from "react";
import { db } from "../firebase";
import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { KnowledgeModal, categoryOf } from "../KnowledgeHub.jsx";

export function draftFromCase(caseData, project) {
  const steps = (caseData.updateLog || []).map((u) => String(u.text || "").trim()).filter(Boolean);
  const draft = {
    title: caseData.title || "",
    problem: String(caseData.note || "").trim(),
    cause: "",
    solution: steps.join("\n"),
    tags: [...new Set([project?.name, caseData.site, caseData.type].filter(Boolean))],
  };
  draft.category = categoryOf({ title: `${draft.title} ${project?.name || ""} ${caseData.type || ""}`, tags: draft.tags });
  return draft;
}

export default function CaseToKnowledge({ caseData, project, currentUser, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const draft = draftFromCase(caseData, project);
  async function save(data) {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db, "knowledge"), {
        ...data, createdBy: currentUser?.name || "", createdAt: now, fromCaseId: caseData.id,
      });
      await setDoc(doc(db, "cases", caseData.id), { knowledgeId: ref.id }, { merge: true });
      onSaved?.(ref.id);
      onClose();
    } catch (e) {
      console.error(e);
      alert("บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }
  return (
    <KnowledgeModal editRecord={draft} saving={saving} onClose={onClose} onSave={save}
      heading="💡 บันทึกวิธีแก้ลง Knowledge Hub"
      intro={<>✅ ปิดเคส "<b>{caseData.title}</b>" แล้ว — เก็บวิธีแก้ไว้ให้ทีมไหม? ข้อมูลด้านล่างเติมจากเคสให้แล้ว แก้ให้กระชับก่อนบันทึกได้ (ไม่บันทึกก็กดปิดได้เลย)</>} />
  );
}
