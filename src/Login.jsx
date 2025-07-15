import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login({ setView, onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");

  const handleChange = e =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data && data.user) {
      // Buscar perfil à tabela utilizadores
      const { data: perfil, error: perfilError } = await supabase
        .from("utilizadores")
        .select("*")
        .eq("auth_id", data.user.id)
        .single();

      if (perfilError) {
        setMessage("Erro ao obter perfil do utilizador.");
        return;
      }

      // Verificação do estado da conta
      if (perfil && (perfil.aprovado === false || perfil.ativo === false)) {
        setMessage(
          perfil.aprovado === false
            ? "A sua conta aguarda aprovação do comando."
            : "A sua conta está bloqueada. Contacte o comando."
        );
        return;
      }

      // Se passou as verificações, faz login normal
      onLogin(data.user);

    } else {
      setMessage("Erro no login. Tente novamente.");
    }
  };

  return (
    <>
      <img src="/logoprotecaocivil.png" alt="Proteção Civil" className="logo" />
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <button type="submit">Entrar</button>
      </form>
      {message && <div className="message">{message}</div>}
      <div className="alt-action">
        <button type="button" onClick={() => setView("register")}>
          Criar Conta
        </button>
      </div>
    </>
  );
}
