"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
	const { error } = await supabase.auth.signInWithPassword({
	  email,
	  password,
	});

	if (!error) {
	  router.push("/orders");
	} else {
	  alert(error.message);
	}
  };

  const signup = async () => {
	const { error } = await supabase.auth.signUp({
	  email,
	  password,
	});

	if (error) alert(error.message);
	else alert("登録成功！");
  };

  return (
	<div style={{ padding: 40 }}>
	  <h1>スタッフログイン</h1>

	  <input
		placeholder="email"
		value={email}
		onChange={(e) => setEmail(e.target.value)}
	  />
	  <br />
	  <input
		placeholder="password"
		type="password"
		value={password}
		onChange={(e) => setPassword(e.target.value)}
	  />
	  <br />
	  <button onClick={login}>ログイン</button>
	  <button onClick={signup}>新規登録</button>
	</div>
  );
}