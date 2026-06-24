import { useEffect, useMemo, useRef, useState } from "react";
import SunCalc from "suncalc";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeAngle = (angle) => ((angle % 360) + 360) % 360;

function formatTime(value) {
  return value
    ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "확인 불가";
}

function getMoonEmoji(phase) {
  if (!phase) return "🌙";
  if (phase.phase < 0.03 || phase.phase > 0.97) return "🌑";
  if (phase.phase < 0.22) return "🌒";
  if (phase.phase < 0.28) return "🌓";
  if (phase.phase < 0.47) return "🌔";
  if (phase.phase < 0.53) return "🌕";
  if (phase.phase < 0.72) return "🌖";
  if (phase.phase < 0.78) return "🌗";
  return "🌘";
}

function getMoonStatus(info) {
  if (!info) return "달 위치 계산 중";
  if (info.altitude < 0) return "달이 지평선 아래에 있습니다";
  if (info.altitude < 10) return "달이 지평선 가까이에 있습니다";
  if (info.altitude < 40) return "달이 하늘에 보입니다";
  return "달이 높이 떠 있습니다";
}

function getNextMoonTimes(lat, lon) {
  const now = new Date();
  const days = [0, 1, 2].map((day) => SunCalc.getMoonTimes(new Date(now.getTime() + day * 86400000), lat, lon));
  const next = (key) => days.map((times) => times[key]).find((time) => time && time > now) ?? null;
  return { nextRise: next("rise"), nextSet: next("set") };
}

function App() {
  const videoRef = useRef(null);
  const rawPitchRef = useRef(90);
  const smoothHeadingRef = useRef(0);
  const smoothPitchRef = useRef(0);

  const [started, setStarted] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [moonInfo, setMoonInfo] = useState(null);
  const [moonPhase, setMoonPhase] = useState(null);
  const [nextTimes, setNextTimes] = useState(null);
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [pitchReference, setPitchReference] = useState(90);
  const [orientationStatus, setOrientationStatus] = useState("대기 중");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const fallbackBackground = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 2400"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#0b1026"/><stop offset=".6" stop-color="#18255a"/><stop offset="1" stop-color="#070d21"/></linearGradient></defs><rect width="1200" height="2400" fill="url(#g)"/><circle cx="920" cy="300" r="105" fill="#fff6c9"/><circle cx="965" cy="270" r="105" fill="#0b1026"/><g fill="white" opacity=".8"><circle cx="130" cy="210" r="3"/><circle cx="340" cy="320" r="2"/><circle cx="560" cy="150" r="3"/><circle cx="720" cy="430" r="2"/><circle cx="1050" cy="190" r="3"/></g><path d="M0 1870Q300 1660 620 1850T1200 1780V2400H0Z" fill="#09132d"/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, []);

  const startApp = async () => {
    setStarted(true);
    if (!navigator.geolocation) setLocationError("이 브라우저는 위치 정보를 지원하지 않습니다.");
    if (!navigator.mediaDevices?.getUserMedia) setCameraError("이 브라우저는 카메라를 지원하지 않습니다.");
    const OrientationEvent = window.DeviceOrientationEvent;
    if (typeof OrientationEvent?.requestPermission === "function") {
      try {
        const result = await OrientationEvent.requestPermission();
        setOrientationStatus(result === "granted" ? "나침반 연결 중" : "방향 센서 권한 거부됨");
      } catch {
        setOrientationStatus("방향 센서를 사용할 수 없습니다");
      }
    }
  };

  useEffect(() => {
    if (!started || !navigator.geolocation) {
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setLocation({ lat: coords.latitude, lon: coords.longitude });
        setLocationError("");
      },
      (error) => setLocationError(error.code === error.PERMISSION_DENIED ? "위치 권한이 필요합니다." : "현재 위치를 가져오지 못했습니다."),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [started]);

  useEffect(() => {
    if (!started || !navigator.mediaDevices?.getUserMedia) {
      return undefined;
    }
    let stream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((result) => {
        stream = result;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      })
      .catch(() => setCameraError("카메라 없이 안내 화면을 사용 중입니다."));
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [started]);

  useEffect(() => {
    if (!started) return undefined;
    const handleOrientation = (event) => {
      const iosHeading = event.webkitCompassHeading;
      const alpha = event.alpha;
      const nextHeading = typeof iosHeading === "number" ? iosHeading : typeof alpha === "number" ? normalizeAngle(360 - alpha) : null;
      if (nextHeading === null) {
        setOrientationStatus("방향 값을 읽을 수 없습니다");
        return;
      }
      const rawPitch = typeof event.beta === "number" ? event.beta : 90;
      rawPitchRef.current = rawPitch;
      let headingDiff = nextHeading - smoothHeadingRef.current;
      if (headingDiff > 180) headingDiff -= 360;
      if (headingDiff < -180) headingDiff += 360;
      smoothHeadingRef.current = normalizeAngle(smoothHeadingRef.current + headingDiff * 0.12);
      const targetPitch = rawPitch - pitchReference;
      smoothPitchRef.current += (targetPitch - smoothPitchRef.current) * 0.15;
      setHeading(smoothHeadingRef.current);
      setPitch(smoothPitchRef.current);
      setOrientationStatus(typeof iosHeading === "number" || event.absolute ? "절대 나침반 사용 중" : "기기 나침반 사용 중");
    };
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => window.removeEventListener("deviceorientation", handleOrientation, true);
  }, [started, pitchReference]);

  useEffect(() => {
    if (!location) return undefined;
    const updateMoon = () => {
      const now = new Date();
      const position = SunCalc.getMoonPosition(now, location.lat, location.lon);
      setMoonInfo({ azimuth: normalizeAngle((position.azimuth * 180) / Math.PI + 180), altitude: (position.altitude * 180) / Math.PI });
      setMoonPhase(SunCalc.getMoonIllumination(now));
      setNextTimes(getNextMoonTimes(location.lat, location.lon));
    };
    updateMoon();
    const intervalId = window.setInterval(updateMoon, 30000);
    return () => window.clearInterval(intervalId);
  }, [location]);

  const moonVector = useMemo(() => {
    if (!moonInfo) return { x: 0, y: 0 };
    let azimuthDifference = moonInfo.azimuth - heading;
    if (azimuthDifference > 180) azimuthDifference -= 360;
    if (azimuthDifference < -180) azimuthDifference += 360;
    return { x: -clamp(azimuthDifference, -90, 90) * 4.5, y: -clamp(moonInfo.altitude - pitch, -60, 60) * 4.5 };
  }, [heading, moonInfo, pitch]);

  const arrow = useMemo(() => {
    const distance = Math.hypot(moonVector.x, moonVector.y);
    return { angle: (Math.atan2(moonVector.y, moonVector.x) * 180) / Math.PI + 90, opacity: moonInfo?.altitude < 0 ? 0.55 : 1, scale: 1 - Math.min(distance / 700, 0.25) };
  }, [moonInfo, moonVector]);

  const calibrateHorizon = () => {
    setPitchReference(rawPitchRef.current);
    smoothPitchRef.current = 0;
  };

  if (!started) return <main className="start-screen"><button className="start-button" onClick={startApp}><span>🌙</span>달은<br />어디에 있을까?</button><p>카메라와 위치 권한을 허용하면 현재 하늘에서 달 방향을 안내합니다.</p></main>;

  return <main className="app-shell">
    {!cameraReady && <div className="fallback" style={{ backgroundImage: fallbackBackground }} />}
    <video ref={videoRef} autoPlay playsInline muted className={cameraReady ? "camera visible" : "camera"} />
    <div className="shade" />
    <div className="moon" style={{ left: `calc(50% + ${moonVector.x}px)`, top: `calc(50% + ${moonVector.y}px)` }}>{getMoonEmoji(moonPhase)}</div>
    <div className="direction-arrow" style={{ transform: `translate(-50%, -50%) rotate(${arrow.angle}deg) scale(${arrow.scale})`, opacity: arrow.opacity }}><i /></div>
    <section className="info-panel">
      <div>현재 상태: {getMoonStatus(moonInfo)}</div><div>다음 월출: {formatTime(nextTimes?.nextRise)}</div><div>다음 월몰: {formatTime(nextTimes?.nextSet)}</div>
      <div>방향 센서: {orientationStatus}</div><div>달 고도: {moonInfo ? `${moonInfo.altitude.toFixed(1)}°` : "계산 중"}</div>
      {location ? <div>위치: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}</div> : <div>{locationError || "위치 확인 중"}</div>}
      {cameraError && <div>{cameraError}</div>}
    </section>
    <button className="calibrate-button" onClick={calibrateHorizon}>수평 보정</button>
    <p className="calibrate-help">휴대폰을 지평선과 수평으로 든 뒤 누르세요.</p>
    <section className="compass" aria-label={`현재 방향 ${heading.toFixed(0)}도`}><div className="compass-cardinals" style={{ transform: `rotate(${-heading}deg)` }}><b>N</b><span>E</span><span>S</span><span>W</span></div><div className="compass-needle" /><div className="compass-center" /></section>
  </main>;
}

export default App;
