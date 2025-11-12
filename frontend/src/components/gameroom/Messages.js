import React, {useState, useEffect} from "react";
import socket from "../../services/socket";

function Messages({mainPlayer}) {
  //to focus on the input field once the box is opened
  const inputRef = React.createRef();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isChatBoxVisible, setChatBoxVisible] = useState(false);
  const [isMessageReceived, setMessageReceived] = useState(false);

  useEffect(() => {
    socket.on("message", (message) => {
      setMessages((messages) => [...messages, message]);

      // Scroll to bottom of chat and show chat box upon message
      const chatBody = document.querySelector(".chat-body");
      chatBody.scrollTop = chatBody.scrollHeight;
      setMessageReceived(true);
    });
  }, []);

  const toggleChatBox = () => {
    const chatBody = document.querySelector(".chat-body");
    if (!isChatBoxVisible) {
      chatBody.style.display = "block";
      inputRef.current.focus();
      setChatBoxVisible(true);
    } else {
      chatBody.style.display = "none";
      setChatBoxVisible(false);
      setMessageReceived(false);
    }
  };

  const sendMessage = (event) => {
    if (event) {
      event.preventDefault();
    }
    if (!message) return;
    socket.emit("sendMessage", {message: message}, () => {
      setMessage("");
      setMessageReceived(false);
    });
  };

  return (
    <>
      <div className='chatBoxWrapper'>
        <div className={`chat-box chat-box-${mainPlayer === "Player 1" ? "player1" : "player2"}`}>
          <div
            className='chat-head'
            style={{backgroundColor: `${isMessageReceived ? "#0066a2" : "#2c3e50"}`}}
          >
            <h2 className="font-bold p-3">{isMessageReceived ? "New Message(s)" : "Chat Box"}</h2>
            <span onClick={toggleChatBox} className='material-icons'>
              {isChatBoxVisible ? "keyboard_arrow_down" : "keyboard_arrow_up"}
            </span>
          </div>
          <div className='chat-body'>
            <div className='msg-insert'>
              {messages.map((msg, i) => (
                <div key={msg.text + i} className={`msg-${msg.user === mainPlayer ? "send" : "receive"}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            <div className='chat-text' style={{display: "flex"}}>
              <input
                ref={inputRef}
                type='text'
                placeholder='Type a message...'
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyPress={(event) => event.key === "Enter" && sendMessage(event)}
              />
              <span
                onClick={() => sendMessage()}
                className='material-icons'
                style={{
                  margin: "auto",
                  padding: "0.5rem",
                  color: "darkblue",
                  backgroundColor: "white",
                }}
              >
                send
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const MemoizedMessages = React.memo(Messages);
export default MemoizedMessages;
