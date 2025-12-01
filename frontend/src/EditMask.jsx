import { useState, useEffect } from "react";
import axios from 'axios';
import Canvas from './Canvas';


export default function GiveCoordsForUpdate({ data }) {
  const [checkLoad, setCheckLoad] = useState(true);
  const [maskData, setMaskData] = useState(null);
  const [status, setStatus] = useState('');

  const SERVER_URL = process.env.REACT_APP_SERVER_URL;

  useEffect(() => {
    if (!data.mask_task_id) return;

    let interval;

    const checkTask = async () => {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${SERVER_URL}/status/${data.mask_task_id}`);
          const newStatus = res.data.status;

          console.log("Статус:", newStatus);
          setStatus(newStatus);

          if (newStatus === "SUCCESS" || newStatus === "FULFILLED") {
            setMaskData(res.data.result || null);
            setCheckLoad(false);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Помилка перевірки статусу:", err);
        }
      }, 1000);
    };

    checkTask();

    return () => clearInterval(interval);
  }, [data]);

  const decodedMask = maskData ? `data:image/png;base64,${maskData}` : null;

  return (
    <div className="flex justify-center items-center h-full">
      <div className="flex flex-col justify-center items-center p-6 bg-white rounded-2xl shadow-xl max-h-[60%]">
        <h2 className="text-black text-2xl font-semibold mb-6">Редагування маски</h2>
        {checkLoad ? (
          <p>Зачекайте, очікується проаналізована маска</p>
        ) : ("l"
          // <Canvas 
          //   realPhoto={data.properties.thumbnail} 
          //   mask={decodedMask} 
          //   setMask={setMaskData} 
          // />
        )}
      </div>
    </div>
  );
}
