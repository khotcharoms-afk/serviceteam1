import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export function useFirestore() {
  const [projects, setProjects] = useState([]);
  const [cases,    setCases]    = useState([]);
  const [users,    setUsers]    = useState([]);
  const [notifications, setNotifs] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const errHandler = (e) => { console.error("Firestore listener error:", e); setLoading(false); };
    const u1 = onSnapshot(collection(db,"projects"), snap => {
      setProjects(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    }, errHandler);
    const u2 = onSnapshot(collection(db,"cases"), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      const sample = docs.filter(c=>c.status!=="done").slice(0,2);
      console.log("🔍 cases updatedAt sample:", sample.map(c=>({
        title: c.title,
        updatedAt: c.updatedAt,
        updatedAt_type: typeof c.updatedAt,
        createdAt: c.createdAt,
        createdAt_type: typeof c.createdAt,
      })));
      setCases(docs);
    }, errHandler);
    const u3 = onSnapshot(collection(db,"users"), snap => {
      setUsers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }, errHandler);
    const uid = auth.currentUser?.uid;
    const notifQuery = query(
      collection(db,"notifications"),
      where("toUid","==",uid)
    );
    const u4 = onSnapshot(notifQuery, snap => {
      const all = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));
      setNotifs(all);
    }, errHandler);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  return { projects, cases, users, notifications, loading };
}
