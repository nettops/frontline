#include "RestaurantBuilder.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "tony.h"

namespace
{
	UStaticMesh* CubeMesh()
	{
		static UStaticMesh* M = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
		return M;
	}
	UStaticMesh* CylinderMesh()
	{
		static UStaticMesh* M = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
		return M;
	}
	UMaterialInterface* BaseMaterial()
	{
		static UMaterialInterface* M = LoadObject<UMaterialInterface>(
			nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
		return M;
	}

	// Palette, named for what it reads as rather than numbered — same
	// convention as WBArena's Palette4, extended to a whole building's
	// worth of zones. Warm/dark split follows section 3 of the brief:
	// the front of house is lit and lived-in, the back of house is where
	// the color drops out.
	enum EColor : int32
	{
		Wall, ExteriorWall, DiningFloorA, DiningFloorB, BarFloor, BarWood,
		KitchenFloor, KitchenSteel, StorageFloor, StorageShelf,
		HallwayFloor, PrivateFloor, PrivateLeather, TableWood, ChairDark,
		ColorCount
	};

	const FLinearColor& PaletteColor(int32 Index)
	{
		static const FLinearColor P[ColorCount] = {
			FLinearColor(0.42f, 0.36f, 0.28f), // Wall (interior, warm plaster)
			FLinearColor(0.20f, 0.18f, 0.16f), // ExteriorWall (darker, reads as "outside")
			FLinearColor(0.80f, 0.77f, 0.70f), // DiningFloorA (checker, cream)
			FLinearColor(0.10f, 0.09f, 0.08f), // DiningFloorB (checker, near-black)
			FLinearColor(0.30f, 0.19f, 0.11f), // BarFloor (dark wood)
			FLinearColor(0.22f, 0.13f, 0.07f), // BarWood (counter, darker still)
			FLinearColor(0.72f, 0.73f, 0.75f), // KitchenFloor (light tile)
			FLinearColor(0.60f, 0.61f, 0.63f), // KitchenSteel (equipment)
			FLinearColor(0.45f, 0.45f, 0.45f), // StorageFloor (concrete)
			FLinearColor(0.35f, 0.30f, 0.24f), // StorageShelf
			FLinearColor(0.16f, 0.13f, 0.11f), // HallwayFloor (dark — back of house)
			FLinearColor(0.30f, 0.05f, 0.05f), // PrivateFloor (deep red)
			FLinearColor(0.40f, 0.06f, 0.06f), // PrivateLeather
			FLinearColor(0.28f, 0.18f, 0.10f), // TableWood
			FLinearColor(0.08f, 0.07f, 0.06f), // ChairDark
		};
		return P[FMath::Clamp(Index, 0, (int32)ColorCount - 1)];
	}

	// Building footprint, in cm (1 UU = 1cm). X is depth (0 = street
	// front, +X = further back); Y is width. See RestaurantBuilder.h for
	// why the plan is shaped the way it is.
	constexpr float WallH = 280.f, WallT = 20.f;
	constexpr float BuildingX = 3000.f, BuildingY = 2200.f;
	constexpr float DiningX0 = 300.f, DiningX1 = 1800.f;
	constexpr float BarY1 = 500.f;                 // bar strip: Y [0, BarY1]
	constexpr float BackX0 = 1800.f, BackX1 = 3000.f;
	constexpr float KitchenY1 = 1300.f;             // kitchen/storage row: Y [0, KitchenY1]
	constexpr float StorageX0 = 2500.f;             // storage: X [StorageX0, BackX1]
	constexpr float HallwayY1 = 1600.f;             // hallway: Y [KitchenY1, HallwayY1]
	// private room: Y [HallwayY1, BuildingY]
	constexpr float EntranceY0 = 900.f, EntranceY1 = 1300.f;
}

ARestaurantBuilder::ARestaurantBuilder()
{
	PrimaryActorTick.bCanEverTick = false;
	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(SceneRoot);
}

void ARestaurantBuilder::BeginPlay()
{
	Super::BeginPlay();
	Build();
}

UStaticMeshComponent* ARestaurantBuilder::Slab(const FVector& Center, const FVector& Size, int32 ColorIndex, bool bCollide)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this);
	C->SetupAttachment(SceneRoot);
	C->SetStaticMesh(CubeMesh());
	C->SetWorldLocation(GetActorLocation() + Center);
	// The engine cube is 100x100x100uu; scale is a direct size-in-cm/100.
	C->SetWorldScale3D(Size / 100.f);
	C->SetCollisionEnabled(bCollide ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
	C->SetCollisionResponseToAllChannels(bCollide ? ECR_Block : ECR_Ignore);
	C->SetCastShadow(true);
	C->RegisterComponent();

	if (UMaterialInterface* Base = BaseMaterial())
	{
		C->SetMaterial(0, Base);
	}
	if (UMaterialInstanceDynamic* Mid = C->CreateAndSetMaterialInstanceDynamic(0))
	{
		Mid->SetVectorParameterValue(TEXT("Color"), PaletteColor(ColorIndex));
		Mid->SetScalarParameterValue(TEXT("Roughness"), 0.85f);
	}

	++PieceCount;
	return C;
}

UStaticMeshComponent* ARestaurantBuilder::Column(const FVector& Center, float Radius, float Height, int32 ColorIndex)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this);
	C->SetupAttachment(SceneRoot);
	C->SetStaticMesh(CylinderMesh());
	C->SetWorldLocation(GetActorLocation() + Center);
	// The engine cylinder is 100uu diameter x 100uu tall.
	C->SetWorldScale3D(FVector(Radius * 2.f / 100.f, Radius * 2.f / 100.f, Height / 100.f));
	C->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	C->SetCollisionResponseToAllChannels(ECR_Block);
	C->SetCastShadow(true);
	C->RegisterComponent();

	if (UMaterialInterface* Base = BaseMaterial())
	{
		C->SetMaterial(0, Base);
	}
	if (UMaterialInstanceDynamic* Mid = C->CreateAndSetMaterialInstanceDynamic(0))
	{
		Mid->SetVectorParameterValue(TEXT("Color"), PaletteColor(ColorIndex));
		Mid->SetScalarParameterValue(TEXT("Roughness"), 0.85f);
	}

	++PieceCount;
	return C;
}

void ARestaurantBuilder::Label(const FVector& Center, const FString& Text)
{
	UTextRenderComponent* T = NewObject<UTextRenderComponent>(this);
	T->SetupAttachment(SceneRoot);
	T->SetWorldLocation(GetActorLocation() + Center);
	T->SetWorldRotation(FRotator(90.f, 0.f, 0.f)); // face up, readable from the 3/4 camera above
	T->SetText(FText::FromString(Text));
	T->SetWorldSize(48.f);
	T->SetHorizontalAlignment(EHTA_Center);
	T->SetTextRenderColor(FColor(220, 210, 195));
	T->RegisterComponent();
}

void ARestaurantBuilder::WallAlongX(float ConstY, float X0, float X1, float Height, int32 ColorIndex, float GapStart, float GapEnd)
{
	const bool bHasGap = GapEnd > GapStart;
	if (!bHasGap || GapStart <= X0)
	{
		if (bHasGap && GapEnd > X0)
		{
			// gap eats the start of the run — only draw the far side
			Slab(FVector((GapEnd + X1) * 0.5f, ConstY, Height * 0.5f), FVector(X1 - GapEnd, WallT, Height), ColorIndex);
			return;
		}
		Slab(FVector((X0 + X1) * 0.5f, ConstY, Height * 0.5f), FVector(X1 - X0, WallT, Height), ColorIndex);
		return;
	}
	// segment before the gap
	if (GapStart > X0)
	{
		Slab(FVector((X0 + GapStart) * 0.5f, ConstY, Height * 0.5f), FVector(GapStart - X0, WallT, Height), ColorIndex);
	}
	// segment after the gap
	if (GapEnd < X1)
	{
		Slab(FVector((GapEnd + X1) * 0.5f, ConstY, Height * 0.5f), FVector(X1 - GapEnd, WallT, Height), ColorIndex);
	}
}

void ARestaurantBuilder::WallAlongY(float ConstX, float Y0, float Y1, float Height, int32 ColorIndex, float GapStart, float GapEnd)
{
	const bool bHasGap = GapEnd > GapStart;
	if (!bHasGap)
	{
		Slab(FVector(ConstX, (Y0 + Y1) * 0.5f, Height * 0.5f), FVector(WallT, Y1 - Y0, Height), ColorIndex);
		return;
	}
	if (GapStart > Y0)
	{
		Slab(FVector(ConstX, (Y0 + GapStart) * 0.5f, Height * 0.5f), FVector(WallT, GapStart - Y0, Height), ColorIndex);
	}
	if (GapEnd < Y1)
	{
		Slab(FVector(ConstX, (GapEnd + Y1) * 0.5f, Height * 0.5f), FVector(WallT, Y1 - GapEnd, Height), ColorIndex);
	}
}

void ARestaurantBuilder::Build()
{
	PieceCount = 0;

	// ---------------------------------------------------------- floors
	// Dining + bar: one open room, Y [0, BuildingY], X [DiningX0, DiningX1].
	// Bar strip (Y < BarY1) gets its own tint and counter; the rest is the
	// dining checker floor — 150cm tiles, big enough to keep the piece
	// count sane, small enough to read as a pattern rather than one slab.
	for (float x = DiningX0; x < DiningX1; x += 150.f)
	{
		for (float y = BarY1; y < BuildingY; y += 150.f)
		{
			const int32 checker = (FMath::RoundToInt(x / 150.f) + FMath::RoundToInt(y / 150.f)) % 2;
			Slab(FVector(x + 75.f, y + 75.f, -5.f), FVector(150.f, 150.f, 10.f),
				checker ? DiningFloorA : DiningFloorB, false);
		}
	}
	Slab(FVector((DiningX0 + DiningX1) * 0.5f, BarY1 * 0.5f, -5.f), FVector(DiningX1 - DiningX0, BarY1, 10.f), BarFloor, false);

	// Kitchen / storage are two floors, split at StorageX0.
	Slab(FVector((BackX0 + StorageX0) * 0.5f, KitchenY1 * 0.5f, -4.f), FVector(StorageX0 - BackX0, KitchenY1, 8.f), KitchenFloor, false);
	Slab(FVector((StorageX0 + BackX1) * 0.5f, KitchenY1 * 0.5f, -4.f), FVector(BackX1 - StorageX0, KitchenY1, 8.f), StorageFloor, false);
	Slab(FVector((BackX0 + BuildingX) * 0.5f, (KitchenY1 + HallwayY1) * 0.5f, -5.f), FVector(BackX1 - BackX0, HallwayY1 - KitchenY1, 10.f), HallwayFloor, false);
	Slab(FVector((BackX0 + BuildingX) * 0.5f, (HallwayY1 + BuildingY) * 0.5f, -5.f), FVector(BackX1 - BackX0, BuildingY - HallwayY1, 10.f), PrivateFloor, false);
	Slab(FVector(DiningX0 * 0.5f, (EntranceY0 + EntranceY1) * 0.5f, -5.f), FVector(DiningX0, EntranceY1 - EntranceY0, 10.f), DiningFloorA, false);

	// ---------------------------------------------------------- exterior walls
	WallAlongY(0.f, 0.f, BuildingY, WallH, ExteriorWall, EntranceY0, EntranceY1); // front, street side, door gap
	WallAlongY(BuildingX, 0.f, BuildingY, WallH, ExteriorWall);
	WallAlongX(0.f, 0.f, BuildingX, WallH, ExteriorWall);
	WallAlongX(BuildingY, 0.f, BuildingX, WallH, ExteriorWall);

	// ---------------------------------------------------------- interior walls
	// Guest side (dining+bar) vs. back of house — one wall, two doorways:
	// a kitchen service gap near the bar, a hallway gap near the private
	// room, kept well apart so neither reads as the other's entrance.
	// WallAlongY only takes one gap, so this is three explicit segments
	// rather than two overlapping single-gap calls — the first draft did
	// that, and each call redraws almost the whole wall around its own
	// gap, quadrupling the actual geometry for no reason.
	WallAlongY(DiningX1, 0.f, 550.f, WallH, Wall);
	WallAlongY(DiningX1, 850.f, 1350.f, WallH, Wall);
	WallAlongY(DiningX1, 1550.f, BuildingY, WallH, Wall);

	WallAlongX(KitchenY1, BackX0, BackX1, WallH, Wall, 2200.f, 2500.f);   // kitchen/storage -> hallway
	WallAlongX(HallwayY1, BackX0, BackX1, WallH, Wall, 2200.f, 2500.f);  // hallway -> private room
	WallAlongY(StorageX0, 0.f, KitchenY1, WallH, Wall, 550.f, 750.f);     // kitchen -> storage

	// ---------------------------------------------------------- furniture
	// Bar: counter + a line of stools.
	Slab(FVector((DiningX0 + DiningX1) * 0.5f, 350.f, 50.f), FVector(1200.f, 60.f, 100.f), BarWood);
	for (float x = 500.f; x <= 1600.f; x += 220.f)
	{
		Column(FVector(x, 220.f, 45.f), 18.f, 90.f, ChairDark);
	}

	// Dining: a grid of tables with chairs, and booths along the back wall.
	for (float x = 500.f; x <= 1650.f; x += 380.f)
	{
		for (float y = 750.f; y <= 2000.f; y += 380.f)
		{
			Slab(FVector(x, y, 38.f), FVector(80.f, 80.f, 75.f), TableWood);
			Column(FVector(x - 70.f, y, 25.f), 15.f, 50.f, ChairDark);
			Column(FVector(x + 70.f, y, 25.f), 15.f, 50.f, ChairDark);
			Column(FVector(x, y - 70.f, 25.f), 15.f, 50.f, ChairDark);
			Column(FVector(x, y + 70.f, 25.f), 15.f, 50.f, ChairDark);
		}
	}
	for (float x = 400.f; x <= 1700.f; x += 300.f)
	{
		Slab(FVector(x, BuildingY - 60.f, 45.f), FVector(220.f, 70.f, 90.f), PrivateLeather); // booth bench
	}

	// Kitchen: a line of equipment along the back wall + a prep island.
	for (float x = BackX0 + 100.f; x <= StorageX0 - 100.f; x += 350.f)
	{
		Slab(FVector(x, KitchenY1 - 60.f, 45.f), FVector(280.f, 80.f, 90.f), KitchenSteel);
	}
	Slab(FVector((BackX0 + StorageX0) * 0.5f, KitchenY1 * 0.5f, 40.f), FVector(300.f, 90.f, 80.f), KitchenSteel);

	// Storage: shelving units.
	for (float y = 100.f; y <= KitchenY1 - 200.f; y += 260.f)
	{
		Slab(FVector(StorageX0 + 100.f, y, 90.f), FVector(60.f, 200.f, 180.f), StorageShelf);
	}

	// Private room: one long table, chairs down both sides. The scene the
	// director brief's "The Meeting" and "The Betrayal" boss moments (section
	// 14) actually happen in.
	const float PrivMidY = (HallwayY1 + BuildingY) * 0.5f;
	const float PrivMidX = (BackX0 + BackX1) * 0.5f;
	Slab(FVector(PrivMidX, PrivMidY, 38.f), FVector(500.f, 120.f, 75.f), TableWood);
	for (float x = PrivMidX - 180.f; x <= PrivMidX + 180.f; x += 120.f)
	{
		Column(FVector(x, PrivMidY - 90.f, 25.f), 16.f, 50.f, PrivateLeather);
		Column(FVector(x, PrivMidY + 90.f, 25.f), 16.f, 50.f, PrivateLeather);
	}

	// ---------------------------------------------------------- labels
	Label(FVector(150.f, (EntranceY0 + EntranceY1) * 0.5f, WallH + 20.f), TEXT("1. ENTRANCE"));
	Label(FVector((DiningX0 + DiningX1) * 0.5f, (BarY1 + BuildingY) * 0.5f, WallH + 20.f), TEXT("2. DINING AREA"));
	Label(FVector((DiningX0 + DiningX1) * 0.5f, BarY1 * 0.5f, WallH + 20.f), TEXT("3. BAR"));
	Label(FVector((BackX0 + StorageX0) * 0.5f, KitchenY1 * 0.5f, WallH + 20.f), TEXT("4. KITCHEN"));
	Label(FVector((StorageX0 + BackX1) * 0.5f, KitchenY1 * 0.5f, WallH + 20.f), TEXT("5. STORAGE"));
	Label(FVector((BackX0 + BackX1) * 0.5f, (KitchenY1 + HallwayY1) * 0.5f, WallH + 20.f), TEXT("6. BACK HALLWAY"));
	Label(FVector(PrivMidX, PrivMidY, WallH + 20.f), TEXT("7. PRIVATE ROOM"));

	EntranceLocation = GetActorLocation() + FVector(150.f, (EntranceY0 + EntranceY1) * 0.5f, 100.f);

	UE_LOG(LogFrontlineSmoke, Display, TEXT("[Frontline] Restaurant built: 7 rooms, %d pieces, entrance at %s"),
		PieceCount, *EntranceLocation.ToString());
}
