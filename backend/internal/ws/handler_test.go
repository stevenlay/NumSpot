package ws

import "testing"

func TestValidateName(t *testing.T) {
	tests := []struct {
		input   string
		wantOut string
		wantErr string
	}{
		{"Alice", "Alice", ""},
		{"  Alice  ", "Alice", ""},
		{"Al", "Al", ""},
		{"AAAAAAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAAAAAA", ""},  // 24 chars: ok
		{"", "", "name is required"},
		{"   ", "", "name is required"},
		{"A", "", "name must be at least 2 characters"},
		{" A ", "", "name must be at least 2 characters"},
		{"AAAAAAAAAAAAAAAAAAAAAAAAA", "", "name must be 24 characters or fewer"}, // 25 chars
		{"hello!", "", "name contains invalid characters"},
		{"hello@world", "", "name contains invalid characters"},
		{"hello world", "hello world", ""},
		{"o'Brien", "o'Brien", ""},
		{"user-name", "user-name", ""},
		{"user.name", "user.name", ""},
		{"user_name", "user_name", ""},
		{"123", "123", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			out, errMsg := validateName(tt.input)
			if out != tt.wantOut {
				t.Errorf("validateName(%q) name = %q, want %q", tt.input, out, tt.wantOut)
			}
			if errMsg != tt.wantErr {
				t.Errorf("validateName(%q) errMsg = %q, want %q", tt.input, errMsg, tt.wantErr)
			}
		})
	}
}
