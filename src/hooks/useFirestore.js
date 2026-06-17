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
  const [onsiteRecords, setOnsiteRecords] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const errHandler = (e) => { console.error("Firestore listener error:", e); setLoading(false); };

    // ── Realtime listeners ──
    const u2 = onSnapshot(collection(db,"cases"), snap => {
      setCases(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }, errHandler);
    getDocs(collection(db,"users")).then(snap => {
      setUsers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }).catch(errHandler);
    const uid = auth.currentUser?.uid;
    const u4 = onSnapshot(query(collection(db,"notifications"),where("toUid","==",uid),where("read","==",false)), snap => {
      const all = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));
      setNotifs(all);
    }, errHandler);

    const u5 = onSnapshot(collection(db,"onsiteRecords"), snap => {
      setOnsiteRecords(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }, errHandler);

    // ── One-time reads ──
    getDocs(collection(db,"projects")).then(snap => {
      setProjects(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    }).catch(errHandler);

    getDocs(collection(db,"shifts")).then(snap => {
      setShifts(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(errHandler);

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

    return () => { u2(); u4(); u5(); };
  }, []);

  function refreshUsers() {
    getDocs(collection(db,"users")).then(snap => {
      setUsers(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(e => console.error(e));
  }

  function refreshProjects() {
    getDocs(collection(db,"projects")).then(snap => {
      setProjects(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(e => console.error(e));
  }

  function refreshShifts() {
    getDocs(collection(db,"shifts")).then(snap => {
      setShifts(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(e => console.error(e));
  }

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

  return { projects, cases, users, notifications, deletedCases, shifts, shiftTypes, userSchedules, shiftMembers, onsiteRecords, loading, refreshProjects, refreshShifts, refreshSchedules, refreshShiftTypes, refreshShiftMembers, refreshUsers };
}
