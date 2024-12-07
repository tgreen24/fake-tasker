import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from './firebase';  // Firestore config
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";  // Firestore functions

function JoinGame() {
  const [gameCode, setGameCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const location = useLocation();  // Get the location object to access passed state
  const navigate = useNavigate();
  
  // Get the player name from the Home screen
  const playerName = location.state?.playerName || '';
  const maxPlayers = 25; // Define max players here

  const handleJoinGame = async (e) => {
    e.preventDefault();

    // Firestore reference to the game document
    const gameRef = doc(db, "games", gameCode);

    try {
      // Check if the game exists
      const gameDoc = await getDoc(gameRef);

      if (gameDoc.exists()) {
        const gameData = gameDoc.data();
        const currentPlayers = gameData.players || [];

        // Check if the game is already full
        if (currentPlayers.length >= maxPlayers) {
          setErrorMessage("The game is full. Please try another game.");
          return;
        }

        // If the game exists and isn't full, add the player to the Firestore document
        await updateDoc(gameRef, {
          players: arrayUnion(playerName)  // Add the player from the Home screen
        });

        // Redirect to the GameLobby with the game code and player name
        navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator: false } });
      } else {
        // If the game does not exist, show an error message
        setErrorMessage("Invalid game code. Please try again.");
      }
    } catch (error) {
      console.error("Error joining game: ", error);
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="join-game-container">
      <div className="join-game-card">
        <h2>Join a Game</h2>
        <form onSubmit={handleJoinGame} className="join-form">
          <input
            type="text"
            placeholder="Enter game code"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            required
            className="join-input"
          />
          <button type="submit" className="join-button">Join Game</button>
        </form>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </div>
    </div>
  );
}

export default JoinGame;