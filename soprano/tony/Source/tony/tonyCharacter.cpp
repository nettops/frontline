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

	// Activate ticking in order to update the cursor every frame.
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = true;
}

void AtonyCharacter::BeginPlay()
{
	Super::BeginPlay();

	// stub
}

void AtonyCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

	// stub
}

void AtonyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	UE_LOG(LogTemp, Warning, TEXT("[Zoom] SetupPlayerInputComponent called, binding scroll keys"));

	// Discrete key events, not an axis — fires once per wheel notch and
	// needs nothing registered in Project Settings to work.
	PlayerInputComponent->BindKey(EKeys::MouseScrollUp, IE_Pressed, this, &AtonyCharacter::ZoomIn);
	PlayerInputComponent->BindKey(EKeys::MouseScrollDown, IE_Pressed, this, &AtonyCharacter::ZoomOut);
}

void AtonyCharacter::ZoomIn() { UE_LOG(LogTemp, Warning, TEXT("[Zoom] ZoomIn fired")); ZoomBy(-ZoomSpeed); }
void AtonyCharacter::ZoomOut() { UE_LOG(LogTemp, Warning, TEXT("[Zoom] ZoomOut fired")); ZoomBy(ZoomSpeed); }

void AtonyCharacter::ZoomBy(float Delta)
{
	if (!CameraBoom)
	{
		UE_LOG(LogTemp, Warning, TEXT("[Zoom] No CameraBoom!"));
		return;
	}

	CameraBoom->TargetArmLength = FMath::Clamp(CameraBoom->TargetArmLength + Delta, MinArmLength, MaxArmLength);
	UE_LOG(LogTemp, Warning, TEXT("[Zoom] ArmLength now %f"), CameraBoom->TargetArmLength);
}
