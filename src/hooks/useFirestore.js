import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";

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

    // ── Realtime listeners ──
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
    const u4 = onSnapshot(query(collection(db,"notifications"),where("toUid","==",uid)), snap => {
      const all = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));
      setNotifs(all);
    }, errHandler);
    const u6 = onSnapshot(collection(db,"shifts"), snap => {
      setShifts(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, errHandler);

    // ── One-time reads (ข้อมูลที่เปลี่ยนนานๆ ครั้ง) ──
    getDocs(collection(db,"deletedCases")).then(snap => {
      const all = snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(b.deletedAt||"").localeCompare(a.deletedAt||""));
      setDeletedCases(all);
    }).catch(errHandler);

    getDocs(collection(db,"shiftTypes")).then(snap => {
      setShiftTypes(snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||"")));
    }).catch(errHandler);

    getDocs(collection(db,"userSchedules")).then(snap => {
      setUserSchedules(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(errHandler);

    getDocs(collection(db,"shiftMembers")).then(snap => {
      setShiftMembers(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(errHandler);

    return () => { u1(); u2(); u3(); u4(); u6(); };
  }, []);

  function refreshSchedules() {
    getDocs(collection(db,"userSchedules")).then(snap => {
      setUserSchedules(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(e => console.error(e));
  }

  function refreshShiftTypes() {
    getDocs(collection(db,"shiftTypes")).then(snap => {
      setShiftTypes(snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||"")));
    }).catch(e => console.error(e));
  }

  function refreshShiftMembers() {
    getDocs(collection(db,"shiftMembers")).then(snap => {
      setShiftMembers(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(e => console.error(e));
  }

  return { projects, cases, users, notifications, deletedCases, shifts, shiftTypes, userSchedules, shiftMembers, loading, refreshSchedules, refreshShiftTypes, refreshShiftMembers };
}
