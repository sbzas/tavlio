import { useState, useEffect } from 'react'
import {Events, WML} from "@wailsio/runtime";


function App() {
  const [time, setTime] = useState<string>('Listening for Time event...');

  useEffect(() => {
    Events.On('time', (timeValue: any) => {
      setTime(timeValue.data);
    });
    // Reload WML so it picks up the wml tags
    WML.Reload();
  }, []);

  return (
    <div className="container">
      <h1>Tavlio</h1>
      <div className="footer">
        <div><p>{time}</p></div>
      </div>
    </div>
  )
}

export default App
