import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase';  // Firestore config
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";  // Firestore functions

function Countdown() {
  const { gameCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const playerName = location.state?.playerName || '';
  const [isCreator, setIsCreator] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [role, setRole] = useState('');

  // Fetch creator and role as soon as the component mounts
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    getDoc(gameRef).then((docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        setIsCreator(gameData.creator === playerName);  // Set if the player is the creator
        setRole(gameData.roles[playerName]);  // Set the role of the player
      }
    });
  }, [gameCode, playerName]);

  // Countdown logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    if (countdown === 0) {
      clearInterval(timer);
    }

    return () => clearInterval(timer);  // Clean up the timer on component unmount
  }, [countdown]);

  // Listener for game deletion
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (!docSnapshot.exists()) {
        console.log("Game deleted. Navigating to home...");
        navigate("/");
      }
    });

    return () => unsubscribe();  // Clean up the listener on component unmount
  }, [gameCode, navigate]);

  // Listener for game end
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();

        // If gameStarted is false, navigate everyone back to the lobby
        if (!gameData.gameStarted) {
          console.log("Game round ended. Navigating back to lobby...");
          navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator, gameStarted: false } });
        }
      }
    });

    return () => unsubscribe();  // Clean up the listener when the component unmounts
  }, [gameCode, navigate, playerName, isCreator]);

  // End the game round
  const endGameRound = async () => {
    const gameRef = doc(db, "games", gameCode);

    try {
      await updateDoc(gameRef, { gameStarted: false });
      console.log("Game round ended.");
    } catch (error) {
      console.error("Error ending game round:", error);
    }
  };

  if (countdown > 0) {
    return <div>Game starting in... {countdown}</div>;
  }

  return (
    <div>
      <h2>{role === 'Imposter' ? 'You are the Imposter!' : 'You are a Crewmate!'}</h2>
      
      {isCreator && (
        <button onClick={endGameRound}>
          End Game Round
        </button>
      )}
    </div>
  );
}

export default Countdown;
