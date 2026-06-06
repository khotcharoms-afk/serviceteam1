import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export function useFirestore() {
  const [projects, setProjects] = useState([]);
  const [cases,    setCases]    = useState([]);
  const [users,    setUsers]    = useState([]);
  const [notifications, setNotifs] = useState([]);
  const [deletedCases, setDeletedCases] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [userSchedules, setUserSchedules] = useState([]);
  const [shiftMembers, setShiftMembers] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const errHandler = (e) => { console.error("Firestore listener error:", e); setLoading(false); };
    const u1 = onSnapshot(collection(db,"projects"), snap => {
      setProjects(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    }, errHandler);
    const u2 = onSnapshot(collection(db,"cases"), snap => {
      setCases(snap.docs.map(d => ({ id:d.id, ...d.data() })));
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
    const u5 = onSnapshot(
      collection(db,"deletedCases"),
      snap => {
        const all = snap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.deletedAt||"").localeCompare(a.deletedAt||""));
        setDeletedCases(all);
      }, errHandler);
    const u6 = onSnapshot(collection(db,"shifts"), snap => {
      setShifts(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, errHandler);
    const u7 = onSnapshot(collection(db,"shiftTypes"), snap => {
      setShiftTypes(snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||"")));
    }, errHandler);
    const u8 = onSnapshot(collection(db,"userSchedules"), snap => {
      setUserSchedules(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, errHandler);
    const u9 = onSnapshot(collection(db,"shiftMembers"), snap => {
      setShiftMembers(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, errHandler);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
  }, []);

  return { projects, cases, users, notifications, deletedCases, shifts, shiftTypes, userSchedules, shiftMembers, loading };
}
