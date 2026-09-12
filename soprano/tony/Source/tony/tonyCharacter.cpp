// Copyright Epic Games, Inc. All Rights Reserved.

#include "tonyCharacter.h"
#include "UObject/ConstructorHelpers.h"
#include "Camera/CameraComponent.h"
#include "Components/DecalComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "Components/InputComponent.h"
#include "Materials/Material.h"
#include "Engine/World.h"
#include "DispositionComponent.h"
#include "RestaurantBuilder.h"
#include "tonyGameMode.h"
#include "tony.h"

AtonyCharacter::AtonyCharacter()
{
	// Set size for player capsule
	GetCapsuleComponent()->InitCapsuleSize(42.f, 96.0f);

	// Don't rotate character to camera direction
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	// Configure character movement
	GetCharacterMovement()->bOrientRotationToMovement = true;
	GetCharacterMovement()->RotationRate = FRotator(0.f, 640.f, 0.f);
	GetCharacterMovement()->bConstrainToPlane = true;
	GetCharacterMovement()->bSnapToPlaneAtStart = true;

	// Create the camera boom component
	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));

	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->SetUsingAbsoluteRotation(true);
	CameraBoom->TargetArmLength = 800.f;
	CameraBoom->SetRelativeRotation(FRotator(-60.f, 0.f, 0.f));
	CameraBoom->bDoCollisionTest = false;

	// Create the camera component
	TopDownCameraComponent = CreateDefaultSubobject<UCameraComponent>(TEXT("TopDownCamera"));

	TopDownCameraComponent->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	TopDownCameraComponent->bUsePawnControlRotation = false;

	Disposition = CreateDefaultSubobject<UDispositionComponent>(TEXT("Disposition"));

	// Activate ticking in order to update the cursor every frame.
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = true;
}

void AtonyCharacter::BeginPlay()
{
	Super::BeginPlay();

	// GameMode's BeginPlay (which spawns the restaurant) runs before any
	// pawn spawns, so the restaurant is guaranteed to exist by the time
	// this runs — no timer, no retry, just a straight lookup. Moving the
	// player to the entrance in code means the level's own PlayerStart
	// (wherever it sits relative to the template's default playground)
	// never has to be touched by hand.
	if (const AtonyGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AtonyGameMode>() : nullptr)
	{
		if (ARestaurantBuilder* Restaurant = GM->GetRestaurant())
		{
			SetActorLocation(Restaurant->GetEntranceLocation());
		}
	}

	// One line, greppable, that a headless run (-game -nullrhi -unattended)
	// can check without a renderer or a human: the pawn spawned, the
	// component hierarchy came up, and the disposition math produces a
	// real answer. This is the whole point of the smoke test — most of
	// tonight's bugs (the axis mapping, the reparent detour) were "does
	// this even run" questions, not "does it look right" ones, and this
	// line answers the first category on its own.
	if (Disposition)
	{
		UE_LOG(LogFrontlineSmoke, Display,
			TEXT("[Frontline] Character ready. Location=%s CameraArm=%.0f Loyalty=%.0f Fear=%.0f Tension=%.2f Lean=%.1f Tag=%s"),
			*GetActorLocation().ToString(),
			CameraBoom ? CameraBoom->TargetArmLength : -1.f,
			Disposition->Loyalty,
			Disposition->Fear,
			Disposition->GetTension(),
			Disposition->GetPostureLean(),
			*Disposition->GetReadoutTag());
	}
	else
	{
		UE_LOG(LogFrontlineSmoke, Error, TEXT("[Frontline] Character ready, but Disposition component is missing!"));
	}
}

void AtonyCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

	// stub
}

void AtonyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	// Discrete key events, not an axis — fires once per wheel notch and
	// needs nothing registered in Project Settings to work.
	PlayerInputComponent->BindKey(EKeys::MouseScrollUp, IE_Pressed, this, &AtonyCharacter::ZoomIn);
	PlayerInputComponent->BindKey(EKeys::MouseScrollDown, IE_Pressed, this, &AtonyCharacter::ZoomOut);
}

void AtonyCharacter::ZoomIn() { ZoomBy(-ZoomSpeed); }
void AtonyCharacter::ZoomOut() { ZoomBy(ZoomSpeed); }

void AtonyCharacter::ZoomBy(float Delta)
{
	if (!CameraBoom)
	{
		return;
	}

	CameraBoom->TargetArmLength = FMath::Clamp(CameraBoom->TargetArmLength + Delta, MinArmLength, MaxArmLength);
}
