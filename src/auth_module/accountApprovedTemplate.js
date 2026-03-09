export const accountApprovedTemplate = (name, link) => {
  return `
    <h2>Hello ${name}</h2>

    <p>Your HRMS account has been approved.</p>

    <p>Please set your password to activate your account.</p>

    <a href="${link}"
       style="
       padding:12px 20px;
       background:#C8102E;
       color:white;
       text-decoration:none;
       border-radius:6px;
       ">
       Set Password
    </a>

    <p>This link expires in 24 hours.</p>
  `;
}