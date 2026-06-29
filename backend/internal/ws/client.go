package ws

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 54 * time.Second
	maxMessageSize = 1024
)

// WSClient is a WebSocket client connected to a room.
type WSClient struct {
	ID          string
	PlayerID    string // stable player identity; equals ID for new connections, original player ID for rejoins
	Name        string
	IsSpectator bool
	RoomCode    string
	Send        chan []byte
	conn        *websocket.Conn
	handler     *Handler
}

// GetID implements game.Client.
func (c *WSClient) GetID() string {
	return c.ID
}

// SendMsg implements game.Client.
func (c *WSClient) SendMsg(data []byte) {
	select {
	case c.Send <- data:
	default:
		// Drop message if channel full
	}
}

// Close implements game.Client.
func (c *WSClient) Close() {
	c.conn.Close()
}

// readPump reads messages from the WebSocket connection and passes them to the handler.
func (c *WSClient) readPump() {
	defer func() {
		c.handler.unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws read error client=%s: %v", c.ID, err)
			}
			break
		}
		c.handler.handleMessage(c, message)
	}
}

// writePump writes messages from the Send channel to the WebSocket connection.
func (c *WSClient) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
