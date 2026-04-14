import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

function App() {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [location, setLocation] = useState(null);
  
  // 실시간 렌더링을 위한 Ref (State는 리렌더링 때문에 애니메이션에 부적합)
  const moonTarget = useRef({ az: 0, alt: 0 });
  const phoneCurrent = useRef({ h: 0, p: 0 });
  const displayPos = useRef({ x: 0, y: 0, opacity: 0 });
  const [renderPos, setRenderPos] = useState({ x: 0, y: 0, opacity: 0 });

  const startApp = async () => {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try { await DeviceOrientationEvent.requestPermission(); } catch (e) { console.error(e); }
    }
    setStarted(true);
  };

  // 1. 위치 및 달 정보 (고정값 위주)
  useEffect(() => {
    if (!started) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      setLocation({ lat, lon });
      
      const updateMoon = () => {
        const moon = SunCalc.getMoonPosition(new Date(), lat, lon);
        // SunCalc: 남쪽이 0도, 서쪽이 +90도 -> 나침반(북쪽 0도)으로 변환
        let az = (moon.azimuth * 180 / Math.PI) + 180; 
        let alt = moon.altitude * 180 / Math.PI;
        moonTarget.current = { az: az % 360, alt };
      };
      updateMoon();
      setInterval(updateMoon, 10000);
    });
  }, [started]);

  // 2. 센서 데이터 수집 및 보정 (Smoothing)
  useEffect(() => {
    if (!started) return;
    const handleOrientation = (e) => {
      // iOS CompassHeading 우선 사용, 없으면 alpha 사용
      let heading = e.webkitCompassHeading || (360 - e.alpha);
      let pitch = e.beta; // 세로 모드에서 앞뒤 기울기

      // 부드러운 이동을 위한 저주파 필터 (Low Pass Filter) 적용
      // 이전 값 90% + 새 값 10% 혼합하여 튀는 현상 방지
      phoneCurrent.current.h = phoneCurrent.current.h * 0.9 + heading * 0.1;
      phoneCurrent.current.p = phoneCurrent.current.p * 0.9 + pitch * 0.1;
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [started]);

  // 3. 애니메이션 루프 (🔥 부드러운 움직임의 핵심)
  useEffect(() => {
    if (!started) return;

    let frameId;
    const loop = () => {
      const { az, alt } = moonTarget.current;
      const { h, p } = phoneCurrent.current;

      // 방위각 차이 계산 (360도 회전 고려)
      let diffHeading = az - h;
      if (diffHeading > 180) diffHeading -= 360;
      if (diffHeading < -180) diffHeading += 360;

      // 폰을 90도로 세웠을 때가 지평선(0도) 기준이 되도록 보정
      let diffPitch = alt - (90 - p);

      // 화면 좌표 변환 (감도 설정)
      const sensitivity = 15;
      const targetX = diffHeading * sensitivity;
      const targetY = -diffPitch * sensitivity;

      // 렌더링 값 부드럽게 추종 (Lerp)
      displayPos.current.x += (targetX - displayPos.current.x) * 0.1;
      displayPos.current.y += (targetY - displayPos.current.y) * 0.1;
      
      // 화면 안에 있을 때만 나타나기
      const isVisible = Math.abs(diffHeading) < 40 && Math.abs(diffPitch) < 40;
      displayPos.current.opacity += ((isVisible ? 1 : 0) - displayPos.current.opacity) * 0.1;

      setRenderPos({
        x: displayPos.current.x,
        y: displayPos.current.y,
        opacity: displayPos.current.opacity
      });

      frameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(frameId);
  }, [started]);

  // 4. 카메라
  useEffect(() => {
    if (!started) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; });
  }, [started]);

  if (!started) return (
    <div style={fullScreenCenter}>
      <button onClick={startApp} style={startButtonStyle}>🌙 달 찾기 시작</button>
    </div>
  );

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", backgroundColor: "#000" }}>
      <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />
      
      {/* 🌙 달 아이콘 */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(calc(-50% + ${renderPos.x}px), calc(-50% + ${renderPos.y}px))`,
        fontSize: "60px",
        opacity: renderPos.opacity,
        filter: "drop-shadow(0 0 10px white)",
        zIndex: 10,
        pointerEvents: "none"
      }}>
        🌙
      </div>

      {/* 가이드 라인 (십자선) */}
      <div style={crosshairStyle} />
    </div>
  );
}

// 스타일 객체들
const fullScreenCenter = { width: "100vw", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#0b0c2a" };
const startButtonStyle = { padding: "20px 40px", fontSize: "20px", borderRadius: "50px", border: "none", background: "#fff", cursor: "pointer" };
const videoStyle = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" };
const crosshairStyle = { position: "absolute", top: "50%", left: "50%", width: "20px", height: "20px", border: "1px solid rgba(255,255,255,0.3)", transform: "translate(-50%, -50%)", borderRadius: "50%" };

export default App;