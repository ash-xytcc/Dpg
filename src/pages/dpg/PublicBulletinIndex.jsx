import React from "react";

export default function PublicBulletinIndex() {
  React.useEffect(() => {
    window.location.replace("/press#updates");
  }, []);

  return null;
}
