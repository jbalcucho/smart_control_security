/**
 * Seed de datos para el demo.
 *
 * Crea:
 *   - 2 puestos en Bogotá con geofence de 100m
 *   - 1 supervisor + 2 guardias asignados
 *
 * Usar con:
 *   npm run db:seed
 *   o
 *   npx prisma db seed
 */

import { PrismaClient, Role, TipoMarca, TipoAlerta, Severidad } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";

async function main() {
  console.log("Seeding database for demo...");

  // ----------------------------------------------------------
  // 1) Limpiar datos previos (en orden por las FKs)
  // ----------------------------------------------------------
  await prisma.alerta.deleteMany();
  await prisma.marca.deleteMany();
  await prisma.user.deleteMany();
  await prisma.puesto.deleteMany();

  console.log("Datos previos limpiados");

  // ----------------------------------------------------------
  // 2) Crear puestos (coordenadas reales de Bogotá)
  // ----------------------------------------------------------
  const puestoNorte = await prisma.puesto.create({
    data: {
      nombre: "Sede Norte",
      direccion: "Cra. 11 #93-46, Chicó Norte, Bogotá",
      latitud: 4.676389,
      longitud: -74.048611,
      radioGeofenceM: 100,
    },
  });

  const puestoSur = await prisma.puesto.create({
    data: {
      nombre: "Sede Sur",
      direccion: "Av. Caracas #45-67, Restrepo, Bogotá",
      latitud: 4.578889,
      longitud: -74.097222,
      radioGeofenceM: 100,
    },
  });

  console.log(`Creados 2 puestos: ${puestoNorte.nombre}, ${puestoSur.nombre}`);

  // ----------------------------------------------------------
  // 3) Crear usuarios (1 supervisor + 2 guardias)
  // ----------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const supervisor = await prisma.user.create({
    data: {
      email: "supervisor@demo.com",
      password: passwordHash,
      nombre: "María Supervisora",
      rol: Role.SUPERVISOR,
    },
  });

  const guardia1 = await prisma.user.create({
    data: {
      email: "guardia1@demo.com",
      password: passwordHash,
      nombre: "Juan Pérez",
      rol: Role.GUARDIA,
      puestoId: puestoNorte.id,
      turnoNombre: "Mañana",
      turnoInicio: "06:00",
      turnoFin: "14:00",
    },
  });

  const guardia2 = await prisma.user.create({
    data: {
      email: "guardia2@demo.com",
      password: passwordHash,
      nombre: "Carlos Rodríguez",
      rol: Role.GUARDIA,
      puestoId: puestoSur.id,
      turnoNombre: "Tarde",
      turnoInicio: "14:00",
      turnoFin: "22:00",
    },
  });

  console.log(`Creados 3 usuarios:`);
  console.log(`   - ${supervisor.email} (SUPERVISOR)`);
  console.log(`   - ${guardia1.email} (GUARDIA → ${puestoNorte.nombre})`);
  console.log(`   - ${guardia2.email} (GUARDIA → ${puestoSur.nombre})`);

  // ----------------------------------------------------------
  // 4) Crear algunas marcas de ejemplo para el dashboard
  // ----------------------------------------------------------
  // Marca válida (dentro del geofence)
  const marcaValida = await prisma.marca.create({
    data: {
      userId: guardia1.id,
      puestoId: puestoNorte.id,
      tipo: TipoMarca.ENTRADA,
      fotoUrl: "https://placehold.co/640x480/22c55e/white?text=Marca+Valida+Demo",
      fotoKey: "demo/marca-valida-demo.jpg",
      latitud: 4.676389,
      longitud: -74.048611,
      precisionM: 8.5,
      distanciaPuestoM: 0,
      dentroDelGeofence: true,
      timestampCliente: new Date(Date.now() - 2 * 60 * 60 * 1000), // hace 2 horas
      userAgent: "Demo Seed Browser",
    },
  });

  // Marca fraudulenta (fuera del geofence)
  const marcaFraude = await prisma.marca.create({
    data: {
      userId: guardia2.id,
      puestoId: puestoSur.id,
      tipo: TipoMarca.ENTRADA,
      fotoUrl: "https://placehold.co/640x480/ef4444/white?text=Marca+Fraude+Demo",
      fotoKey: "demo/marca-fraude-demo.jpg",
      latitud: 4.6,
      longitud: -74.07, // ~3km del puesto Sur
      precisionM: 12.0,
      distanciaPuestoM: 3245.7,
      dentroDelGeofence: false,
      esFraude: true,
      motivoFraude: "Marca registrada a 3245m del puesto asignado (límite: 100m)",
      timestampCliente: new Date(Date.now() - 30 * 60 * 1000), // hace 30 min
      userAgent: "Demo Seed Browser",
    },
  });

  // Alerta asociada a la marca fraudulenta
  await prisma.alerta.create({
    data: {
      marcaId: marcaFraude.id,
      tipo: TipoAlerta.FUERA_GEOFENCE,
      severidad: Severidad.ALTA,
      mensaje: `${guardia2.nombre} marcó fuera del geofence del puesto ${puestoSur.nombre} (3245m)`,
    },
  });

  console.log("Creadas 2 marcas de ejemplo (1 valida + 1 fraude con alerta)");

  // ----------------------------------------------------------
  // 5) Resumen final
  // ----------------------------------------------------------
  const stats = {
    puestos: await prisma.puesto.count(),
    users: await prisma.user.count(),
    marcas: await prisma.marca.count(),
    alertas: await prisma.alerta.count(),
  };

  console.log("\nResumen del seed:");
  console.log(`   Puestos: ${stats.puestos}`);
  console.log(`   Usuarios: ${stats.users}`);
  console.log(`   Marcas: ${stats.marcas}`);
  console.log(`   Alertas: ${stats.alertas}`);
  console.log(`\nCredenciales de demo (password unico: "${DEMO_PASSWORD}"):`);
  console.log(`   - guardia1@demo.com   (guardia, Sede Norte)`);
  console.log(`   - guardia2@demo.com   (guardia, Sede Sur)`);
  console.log(`   - supervisor@demo.com (supervisor)`);
}

main()
  .catch((e) => {
    console.error("Error en el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
